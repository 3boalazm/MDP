"""Modal GPU backend for "Fast Mode" — runs Demucs (htdemucs_ft) on a warm
CUDA container and exposes it over HTTP for the web/ frontend's server-side
separation path. The client-side ONNX pipeline in web/lib/separation stays
the default, privacy-preserving mode; this is the opt-in speed path.

Setup and deploy: see server/README.md.
"""

import hashlib
import hmac
import io
import json
import sys
import time
import zipfile
from collections import defaultdict, deque
from pathlib import Path

import modal

# `add_local_python_source("demucs")` below resolves the package via Python's
# own import system on the machine running `modal serve`/`modal deploy` — put
# the actual repo root (containing demucs-main/demucs/) on sys.path so that
# resolves correctly regardless of the invoking working directory. This file
# lives at <repo>/web/server/app.py, three levels below that root.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

MODEL_NAME = "htdemucs_ft"
MP3_BITRATE = 256
MAX_INPUT_MB = 100  # mirrors web/lib/separation/constants.ts MAX_INPUT_MB
MAX_DURATION_SECONDS = 12 * 60  # mirrors MAX_DURATION_SECONDS
RATE_LIMIT_PER_HOUR = 20  # per container, per client IP — see README caveat


def _verify_token(token: str, secret: str) -> bool:
    """Verifies a short-lived HMAC token minted by the Next.js server (see
    web/app/api/fast-mode-token/route.ts) instead of comparing against a
    static secret — the real secret never has to leave that server, so it
    never ships inside the browser bundle. Stateless (no replay/single-use
    tracking): a captured token is valid for its remaining TTL, which is an
    accepted trade-off for a project this size — see server/README.md."""
    try:
        expires_at_str, signature = token.split(".", 1)
        expires_at = int(expires_at_str)
    except (ValueError, AttributeError):
        return False
    if time.time() * 1000 > expires_at:
        return False
    expected = hmac.new(secret.encode(), expires_at_str.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _bake_htdemucs_ft_weights() -> None:
    """Runs once at image build time, while the builder still has network
    access — downloads htdemucs_ft into the HF cache baked into the image
    layer, so deployed containers never hit the network for weights."""
    from demucs.pretrained import get_model

    get_model(MODEL_NAME)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")  # demucs.audio's AudioFile fallback decoder shells out to this
    .pip_install("torch", "torchaudio", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install(
        "einops",
        "huggingface-hub",
        "julius>=0.2.3",
        "lameenc>=1.2",
        "pyyaml",
        "safetensors",
        "sphn>=0.1.12",
        "tqdm",
        "numpy<2",
        "fastapi[standard]",
        "python-multipart",
    )
    # copy=True: the bake step below needs `demucs` importable at BUILD time
    # (not just container startup, which is add_local_python_source's default)
    # — Modal also requires this whenever a build step runs after adding
    # local source, which _bake_htdemucs_ft_weights does.
    .add_local_python_source("demucs", copy=True)
    .env({"HF_HOME": "/cache/huggingface"})
    .run_function(_bake_htdemucs_ft_weights)
    .env({"HF_HUB_OFFLINE": "1"})  # applied AFTER the bake step — runtime containers make zero HF network calls
)

app = modal.App("demucs-fast-mode", image=image)


@app.cls(
    gpu="L4",
    min_containers=1,  # keeps one container warm — avoids ~10-30s cold starts, but bills GPU time continuously
    scaledown_window=300,
    timeout=600,
    secrets=[modal.Secret.from_name("demucs-shared-secret")],
)
@modal.concurrent(max_inputs=1)  # a full-track GPU pass already saturates the GPU; extra load should scale to new containers
class DemucsServer:
    @modal.enter()
    def load(self):
        from demucs.api import Separator

        self.separator = Separator(model=MODEL_NAME, device="cuda", shifts=1, overlap=0.25, split=True)
        self._rate_limit_log: dict[str, deque] = defaultdict(deque)

    def _allow_request(self, client_ip: str) -> bool:
        now = time.time()
        window = self._rate_limit_log[client_ip]
        while window and now - window[0] > 3600:
            window.popleft()
        if len(window) >= RATE_LIMIT_PER_HOUR:
            return False
        window.append(now)
        return True

    @modal.asgi_app()
    def web(self):
        import os
        import tempfile

        from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import Response

        from demucs.audio import save_audio

        web_app = FastAPI()
        web_app.add_middleware(
            CORSMiddleware,
            # Tighten this to the deployed frontend's exact origin once known —
            # left open for local development against `modal serve`.
            allow_origins=["*"],
            allow_methods=["POST"],
            allow_headers=["X-Fast-Mode-Token", "Content-Type"],
        )

        # This secret is shared with (only) the Next.js server's
        # MODAL_SHARED_SECRET — used to verify tokens it mints, never to
        # compare against a value sent by the browser directly. See
        # web/app/api/fast-mode-token/route.ts and _verify_token above.
        shared_secret = os.environ["API_KEY"]

        @web_app.post("/separate")
        async def separate(
            request: Request,
            file: UploadFile = File(...),
            options: str = Form("{}"),
        ):
            token = request.headers.get("X-Fast-Mode-Token", "")
            if not _verify_token(token, shared_secret):
                raise HTTPException(status_code=401, detail="Missing or expired session token.")

            client_ip = request.client.host if request.client else "unknown"
            if not self._allow_request(client_ip):
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_INPUT_MB * 1024 * 1024:
                raise HTTPException(status_code=413, detail=f"File exceeds {MAX_INPUT_MB}MB limit.")

            try:
                wanted = json.loads(options)
            except json.JSONDecodeError:
                wanted = {}
            wanted_sources = {"vocals"} | {s for s in ("drums", "bass", "other") if wanted.get(s, True)}

            raw = await file.read()
            if len(raw) > MAX_INPUT_MB * 1024 * 1024:
                raise HTTPException(status_code=413, detail=f"File exceeds {MAX_INPUT_MB}MB limit.")

            suffix = Path(file.filename or "upload").suffix or ".bin"
            with tempfile.TemporaryDirectory() as tmpdir:
                in_path = Path(tmpdir) / f"input{suffix}"
                in_path.write_bytes(raw)

                try:
                    _, stems = self.separator.separate_audio_file(in_path)
                except Exception as exc:
                    raise HTTPException(status_code=422, detail=f"Couldn't process this file: {exc}")

                duration_seconds = next(iter(stems.values())).shape[-1] / self.separator.samplerate
                if duration_seconds > MAX_DURATION_SECONDS:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Track exceeds the {MAX_DURATION_SECONDS // 60}-minute limit.",
                    )

                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
                    for name, tensor in stems.items():
                        if name not in wanted_sources:
                            continue
                        out_path = Path(tmpdir) / f"{name}.mp3"
                        save_audio(tensor, out_path, samplerate=self.separator.samplerate, bitrate=MP3_BITRATE)
                        zf.write(out_path, arcname=f"{name}.mp3")

            return Response(content=buf.getvalue(), media_type="application/zip")

        return web_app
