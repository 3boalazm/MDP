"""Modal GPU backend for the TRIA drum specialist — separate, additive Modal
App from server/app.py's Demucs "Fast Mode" backend. Deliberately its own
App (not a class/route bolted onto DemucsServer): keeps this experimental,
NC-licensed path fully isolated from the product's actual Fast Mode feature,
and `min_containers=0` here means zero GPU billing happens until this
specific endpoint is actually invoked — deploying it costs nothing beyond a
one-time image build.

Reuses hf-space/tria_chunked.py and hf-space/tria_vendor/ (the validated
chunked-inference module and the real vendored TRIA weights, see
hf-space/TRIA_PRODUCTION_REPORT.md) unmodified — bundled into this image via
add_local_dir so the exact same code/weights already proven correct on local
GPU runs is what's deployed here, not a reimplementation.

LICENSE: TRIA's pretrained weights are CC BY-NC-SA 4.0 (non-commercial), the
code is MIT — see hf-space/README.md "TRIA licensing". This endpoint refuses
to run unless the `tria-license-ack` Modal secret is present, mirroring the
TRIA_ACKNOWLEDGE_NC_LICENSE gate already used in hf-space/app.py.

Setup and deploy: see server/README.md "TRIA drum specialist (Modal)".
"""

import hashlib
import hmac
import sys
import tempfile
import time
from pathlib import Path

import modal

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
HF_SPACE_DIR = REPO_ROOT / "hf-space"

MAX_DURATION_SECONDS = 12 * 60  # mirrors server/app.py and hf-space/app.py


def _verify_token(token: str, secret: str) -> bool:
    """Same HMAC scheme as server/app.py's _verify_token — see that file for
    the full rationale. Reuses the same shared secret (demucs-shared-secret)
    so the Next.js side doesn't need a second one for this experimental path."""
    try:
        expires_at_str, signature = token.split(".", 1)
        expires_at = int(expires_at_str)
    except (ValueError, AttributeError):
        return False
    if time.time() * 1000 > expires_at:
        return False
    expected = hmac.new(secret.encode(), expires_at_str.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("torch", "torchaudio", index_url="https://download.pytorch.org/whl/cu121")
    .pip_install(
        # Traced from hf-space/requirements.txt, minus `demucs`/`spaces`
        # (not used by TRIA's own code — see hf-space/tria_vendor/app.py's
        # import list, no `spaces` import there) — this image only needs to
        # run tria_chunked.py + the vendored TRIA package.
        "gradio>=4.0,<6",
        "librosa",
        "numpy<2",
        "scipy",
        "rich",
        "flatten_dict",
        "primePy",
        "argbind",
        "descript-audiotools",
        "soundfile",
        "fastapi[standard]",
        "python-multipart",
    )
    # Brings tria_chunked.py AND tria_vendor/ (weights + tria/ package) in
    # together, preserving their relative layout — tria_chunked.py's
    # _find_vendored_tria_dir() resolves tria_vendor/ relative to its own
    # __file__, so this only works if both land at the same relative
    # position inside the image as they have on disk. Not baked at build
    # time (no copy=True): nothing here needs to run during the build,
    # unlike server/app.py's htdemucs_ft weight bake.
    .add_local_dir(str(HF_SPACE_DIR), remote_path="/root/hf_space_bundle")
)

app = modal.App("tria-drum-specialist", image=image)


@app.cls(
    gpu="T4",  # chunked inference peaks ~2.4GB VRAM per the local spike — far under even T4's 16GB, no need for L4/A10G
    min_containers=0,  # scales to zero when idle — zero GPU billing between requests
    scaledown_window=300,
    # Generous: chunked processing of a full MAX_DURATION_SECONDS track can
    # take ~1540s+ wall time at the spike's observed RTF (~2.14) — see
    # hf-space/app.py's _tria_lock timeout for the same math.
    timeout=1800,
    secrets=[modal.Secret.from_name("demucs-shared-secret"), modal.Secret.from_name("tria-license-ack")],
)
@modal.concurrent(max_inputs=1)  # one TRIA generation at a time per container — matches hf-space's _tria_lock reasoning
class TriaServer:
    @modal.enter()
    def load(self):
        sys.path.insert(0, "/root/hf_space_bundle")
        import tria_chunked

        self._tria_chunked = tria_chunked
        # Warm the model once per container instead of on first request —
        # mirrors DemucsServer.load() loading the Separator eagerly.
        tria_chunked._load_tria_app(tria_chunked.MODEL_NAME_ENV_DEFAULT)

    @modal.asgi_app()
    def web(self):
        import os
        import torchaudio
        from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import Response

        web_app = FastAPI()
        web_app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["POST"],
            allow_headers=["X-Fast-Mode-Token", "Content-Type"],
        )

        shared_secret = os.environ["API_KEY"]  # from demucs-shared-secret, same value as server/app.py's
        license_ack = os.environ.get("ACKNOWLEDGED", "false").lower() == "true"  # from tria-license-ack

        default_timbre_path = Path("/root/hf_space_bundle/tria_vendor/assets/drums/drums_1.wav")

        @web_app.post("/generate_drums")
        async def generate_drums(
            request: Request,
            rhythm_file: UploadFile = File(...),
            timbre_file: UploadFile | None = File(None),
        ):
            if not license_ack:
                raise HTTPException(
                    status_code=503,
                    detail="TRIA path not licensed for this deployment — see hf-space/README.md 'TRIA licensing'.",
                )
            token = request.headers.get("X-Fast-Mode-Token", "")
            if not _verify_token(token, shared_secret):
                raise HTTPException(status_code=401, detail="Missing or expired session token.")

            with tempfile.TemporaryDirectory() as tmpdir:
                rhythm_path = Path(tmpdir) / "rhythm.wav"
                rhythm_path.write_bytes(await rhythm_file.read())

                if timbre_file is not None:
                    timbre_path = Path(tmpdir) / "timbre.wav"
                    timbre_path.write_bytes(await timbre_file.read())
                else:
                    timbre_path = default_timbre_path

                try:
                    rhythm_wav, rhythm_sr = torchaudio.load(str(rhythm_path))
                    timbre_wav, timbre_sr = torchaudio.load(str(timbre_path))
                except Exception as exc:
                    raise HTTPException(status_code=422, detail=f"Couldn't read the uploaded audio: {exc}")

                duration_seconds = rhythm_wav.shape[-1] / rhythm_sr
                if duration_seconds > MAX_DURATION_SECONDS:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Track exceeds the {MAX_DURATION_SECONDS // 60}-minute limit.",
                    )

                try:
                    stitched, output_sr = self._tria_chunked.generate_drums_chunked(
                        rhythm_wav, rhythm_sr, timbre_wav, timbre_sr
                    )
                except self._tria_chunked.TriaChunkError as exc:
                    raise HTTPException(status_code=422, detail=f"Drum generation failed ({exc.stage}): {exc}")

                out_path = Path(tmpdir) / "generated_drums.wav"
                torchaudio.save(str(out_path), stitched.squeeze(0), output_sr)
                return Response(content=out_path.read_bytes(), media_type="audio/wav")

        return web_app
