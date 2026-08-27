# Fast Mode GPU backend (Modal)

Runs `htdemucs_ft` on a warm CUDA container via [Modal](https://modal.com) and
exposes it as `POST /separate`, for the web app's optional server-side "Fast
Mode". The default, privacy-preserving on-device (ONNX/WebGPU) pipeline in
`web/lib/separation` is unaffected — this is purely an opt-in speed path.

## One-time setup

```bash
pip install modal
modal setup                # authenticates this machine with your Modal account
modal secret create demucs-shared-secret API_KEY=<a-long-random-value>
```

**This secret never reaches the browser.** The frontend authenticates with a
short-lived token minted server-side by `web/app/api/fast-mode-token/route.ts`
(HMAC-signed, 5-minute expiry) — that route and this Modal secret must hold
the **same** value so each can verify the other's tokens. See
`_verify_token` in `app.py` for the check. A captured token is replayable
for its remaining TTL (no single-use tracking) — an accepted trade-off for
this project's size; don't reuse a secret you care about elsewhere.

## Run locally (temporary URL, hot-reloads on save)

```bash
modal serve server/app.py
```

Prints a `*.modal.run` URL. Point `web/.env.local` at it:

```
NEXT_PUBLIC_MODAL_SEPARATE_URL=https://<the-printed-url>/separate
MODAL_SHARED_SECRET=<the-same-value-as-API_KEY-above>
```

`MODAL_SHARED_SECRET` has **no** `NEXT_PUBLIC_` prefix — it must stay
server-only, read only by the `/api/fast-mode-token` route.

Test directly without the frontend (mint a token the same way the route
does, using Python for convenience here):

```bash
TOKEN=$(python3 -c "
import hmac, hashlib, time
secret = '<API_KEY-value>'
expires_at = int(time.time() * 1000) + 300_000
sig = hmac.new(secret.encode(), str(expires_at).encode(), hashlib.sha256).hexdigest()
print(f'{expires_at}.{sig}')
")
curl -X POST "$URL/separate" \
  -H "X-Fast-Mode-Token: $TOKEN" \
  -F "file=@test.mp3" \
  -F 'options={"drums":true,"bass":true,"other":true}' \
  -o out.zip
unzip -l out.zip   # expect vocals.mp3, drums.mp3, bass.mp3, other.mp3
```

## Deploy (persistent production URL)

```bash
modal deploy server/app.py
```

## Deployed endpoint

```
https://boalazm--demucs-fast-mode-demucsserver-web.modal.run/separate
```

Live as of 2026-08-26 under the `boalazm` Modal workspace. Verified with a
real request: HTTP 200, valid `vocals.mp3`/`drums.mp3`/`bass.mp3`/`other.mp3`
in the response zip. ~20s on a cold-ish container, ~12s once warm. Set
`NEXT_PUBLIC_MODAL_SEPARATE_URL` to this URL and `MODAL_SHARED_SECRET` to the
matching `demucs-shared-secret` value (see "One-time setup" above) to use it.

Redeploying (`modal deploy server/app.py` again after changing `app.py`)
reuses this same URL — it doesn't change on redeploy, only on renaming the
app or the Modal class.

## Cost/latency knob to know about

`min_containers=1` in `app.py` keeps one GPU container warm at all times to
avoid ~10-30s cold starts (image pull + CUDA init + weights into VRAM) on the
first request after idle. This bills GPU time continuously even with zero
traffic. For low-traffic/demo use, change it to `min_containers=0` and accept
occasional cold starts instead — tune `scaledown_window` as a middle ground.

GPU tier defaults to `gpu="L4"` (cost-effective for this workload). Check
Modal's current pricing page before relying on any specific $/hr figure — it
changes over time.

## TRIA drum specialist (Modal)

`tria_app.py` is a separate, additive Modal App (`tria-drum-specialist`) for
experimental TRIA-based drum generation — deliberately its own App, not a
class/route on `DemucsServer` above, so it stays fully isolated from the
actual Fast Mode feature. Reuses `hf-space/tria_chunked.py` and
`hf-space/tria_vendor/` (the validated chunked-inference module and real
vendored TRIA weights, see `hf-space/TRIA_PRODUCTION_REPORT.md`) unmodified,
bundled into the image via `add_local_dir`.

**License gate:** refuses to run unless a `tria-license-ack` Modal secret
exists (`ACKNOWLEDGED=true`) — a deliberate, separate acknowledgment that
TRIA's pretrained weights are CC BY-NC-SA 4.0 (non-commercial), not something
this code decides on its own. See `hf-space/README.md` "TRIA licensing".

```bash
modal secret create tria-license-ack ACKNOWLEDGED=true   # only if you accept the NC license terms for this deployment
modal deploy server/tria_app.py
```

Reuses the same `demucs-shared-secret` value as the Demucs backend for auth
(`X-Fast-Mode-Token`) — no separate secret needed for that part.

### Deployed endpoint

```
https://m1aboalazm--tria-drum-specialist-triaserver-web.modal.run/generate_drums
```

Deployed 2026-08-27 under the `m1aboalazm` Modal workspace. `min_containers=0`
— zero GPU billing until a request actually comes in. Build/deploy succeeded
cleanly (all dependencies resolved, `add_local_dir` placed the bundle
correctly), and the underlying generation logic was already proven correct
via extensive local-GPU testing (see `hf-space/TRIA_PRODUCTION_REPORT.md`) —
but **the live endpoint itself has not yet been invoked with a real request**,
by deliberate choice (avoids spending GPU credit until wanted). Run one
request manually to confirm the FastAPI wrapper works end-to-end before
relying on this in anything user-facing:

```bash
TOKEN=$(python3 -c "
import hmac, hashlib, time
secret = '<demucs-shared-secret API_KEY value>'
expires_at = int(time.time() * 1000) + 300_000
sig = hmac.new(secret.encode(), str(expires_at).encode(), hashlib.sha256).hexdigest()
print(f'{expires_at}.{sig}')
")
curl -X POST "https://m1aboalazm--tria-drum-specialist-triaserver-web.modal.run/generate_drums" \
  -H "X-Fast-Mode-Token: $TOKEN" \
  -F "rhythm_file=@test.mp3" \
  -o generated_drums.wav
```

No frontend wiring exists for this endpoint yet (no `web/app/api/` route
calls it) — deliberately deferred, same reasoning as
`hf-space/TRIA_PRODUCTION_REPORT.md` §9a: which GPU host to standardize on,
and whether/how to surface an NC-licensed generation feature in the actual
product UI, are product decisions, not routine wiring.

## Known v1 limitations

- Rate limiting is a simple per-container, in-memory sliding window keyed by
  client IP — not correct across multiple containers (each has its own
  counter). Fine while traffic is low; revisit with a shared store (e.g.
  Redis) only if abuse becomes a real problem.
- Token verification is stateless (no single-use/replay tracking) — a
  captured token works until it expires (5 minutes). The real secret itself
  never reaches the browser, which is the actual goal here; full replay
  protection would need a shared store and isn't worth it at this size.
- No job queue or object storage tier — requests are synchronous
  upload-in/zip-out, which is fine at the 100MB input cap this shares with
  the client-side pipeline.
