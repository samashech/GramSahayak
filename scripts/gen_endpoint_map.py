#!/usr/bin/env python3
"""Generate docs/endpoint-map.md (B-09) from REAL requests against a running Node gateway.

    python3 scripts/gen_endpoint_map.py [BASE_URL]      (default http://localhost:5000)

Uses throwaway phones/session ids (+9199999xxxxx, endpoint-map-*). Long strings in responses are
shortened so the document stays readable; the shapes are exactly what the gateway returned.
"""
import json
import sys
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000").rstrip("/")
OUT = Path(__file__).resolve().parent.parent / "docs" / "endpoint-map.md"
SID = f"endpoint-map-{uuid.uuid4().hex[:8]}"
PHONE = "+919999912345"


def shorten(v, n=90):
    if isinstance(v, str):
        return v if len(v) <= n else v[: n - 1] + "…"
    if isinstance(v, list):
        return [shorten(x, n) for x in v[:3]] + (["…"] if len(v) > 3 else [])
    if isinstance(v, dict):
        return {k: shorten(x, n) for k, x in v.items()}
    return v


def call(method, path, body=None, headers=None, multipart=None):
    h = {"x-session-id": SID, **(headers or {})}
    data = None
    if multipart:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in multipart.items():
            if isinstance(v, tuple):
                fname, content, ctype = v
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
            else:
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        h["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body, ensure_ascii=False).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            status, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    ms = int((time.time() - t0) * 1000)
    try:
        payload = json.loads(raw)
    except ValueError:
        payload = raw.decode("utf-8", "replace")[:200]
    return status, ms, payload


SECTIONS = []


def doc(title, method, path, tab, body=None, headers=None, multipart=None, note="", curl=None):
    status, ms, payload = call(method, path, body, headers, multipart)
    hdr = " ".join(f"-H '{k}: {v}'" for k, v in (headers or {}).items())
    if curl is None:
        curl = f"curl -s -X {method} {BASE}{path} -H 'x-session-id: <uuid>' {hdr}".strip()
        if body is not None:
            curl += f" -H 'Content-Type: application/json' -d '{json.dumps(body, ensure_ascii=False)}'"
    SECTIONS.append((title, method, path, tab, curl, status, ms, payload, note))
    return payload


def main():
    health = doc("Health", "GET", "/api/health", "all (top bar status)")
    doc("Schemes", "GET", "/api/schemes?category=health&languageCode=ta-IN", "Tab 1 / Tab 4")
    doc("Eligibility (G6)", "POST", "/api/eligibility", "Tab 4",
        {"profile": {"occupation": "farmer", "land_hectares": 1.0, "bpl": True, "age": 35, "gender": "female", "pregnant": False, "annual_income": 90000, "social_category": "obc"}, "languageCode": "hi-IN"},
        note="Deterministic rules only (R4). G6 = 8 eligible, 5 ineligible (CCR-02).")
    doc("Chat (G1)", "POST", "/api/chat", "Tab 1 text input",
        {"queryText": "पीएम किसान योजना के लिए कौन पात्र है?", "languageCode": "hi-IN", "category": "schemes", "role": "farmer"})
    doc("Chat safety (S1)", "POST", "/api/chat", "Tab 1 (red safety banner)",
        {"queryText": "सांप ने काट लिया है, अभी क्या करें?", "languageCode": "hi-IN", "role": "farmer"},
        note="safety.flagged=true, helplines [108]; never model text for emergencies.")
    doc("Voice chat", "POST", "/api/voice-chat", "Tab 1 mic", multipart={
        "audio": ("clip.webm", b"demo", "audio/webm"), "role": "asha", "category": "health",
        "transcriptHint": "ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?"},
        curl=f"curl -s {BASE}/api/voice-chat -H 'x-session-id: <uuid>' -F audio=@clip.webm -F role=asha -F category=health -F 'transcriptHint=ஜனனி சுரக்ஷா ...'",
        note="Sarvam STT when SARVAM_API_KEY is set, else transcriptHint (browser SpeechRecognition). audioBase64=null -> useBrowserTts=true.")
    doc("Profile (read)", "GET", "/api/profile", "Tab 1 history list", headers={"x-demo-user": "asha-ta"},
        note="profile is null for a brand-new visitor.")
    doc("Profile (update)", "POST", "/api/profile", "Tab 4 form", {"land_hectares": 1.5, "bpl": True})
    for stage, extra in [("greeting", {}), ("language", {"dtmfDigit": "1"}), ("category", {"dtmfDigit": "1"}),
                         ("speech", {"text": "पीएम किसान योजना के लिए कौन पात्र है?"}), ("goodbye", {})]:
        doc(f"IVR simulator: send stage={stage}", "POST", "/api/ivr-simulate", "Tab 2",
            {"callerPhone": PHONE, "stage": stage, **extra},
            note={"greeting": "Response stage = where the call now is: greeting -> send 'language' next.",
                  "language": "response stage 'language' -> send 'category' next.",
                  "category": "response stage 'category' -> send 'speech' (text or multipart audio) next.",
                  "speech": "response stage 'answer' with AnswerData + SMS receipt (delivery: simulated) -> send 'goodbye'.",
                  "goodbye": "Call ends; state cleared."}[stage])
    doc("SMS simulator (G8 keyword)", "POST", "/api/sms-simulate", "Tab 3", {"fromPhone": PHONE, "body": "PMKISAN"},
        note="Keyword path, no LLM, <300 ms. Reply = seed card sms_summary verbatim (R5).")
    doc("SMS simulator (free text)", "POST", "/api/sms-simulate", "Tab 3", {"fromPhone": PHONE, "body": "गेहूं में पीला रतुआ रोग लगा है, क्या करें?"})
    doc("Demo reset", "POST", "/api/demo/reset", "top bar 'Reset demo'", note="DEMO_MODE only. Restores the 5 personas incl. starter_history.")
    doc("CloudTalk webhook: incoming call", "POST", "/api/cloudtalk/voice/incoming", "CloudTalk only", {"caller_number": PHONE})
    doc("CloudTalk webhook: inbound SMS", "POST", "/api/cloudtalk/sms/incoming", "CloudTalk only", {"from": PHONE, "body": "HELP"})

    lines = [
        "# Endpoint map (B-09) — Node gateway :5000",
        "",
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} by `scripts/gen_endpoint_map.py` against `{BASE}` "
        f"(db={health.get('data', {}).get('db', {}).get('driver')}, rag.ok={health.get('data', {}).get('rag', {}).get('ok')}). "
        "Responses are real; long strings are shortened with `…`. Source of truth for shapes: `docs/api-contract.md`.",
        "",
        "**Every response** is the envelope `{success, data, error, timestamp}`. **Headers**: `x-session-id: <uuid>` on every browser request; "
        "optional `x-demo-user: farmer-hi | farmer-mr | asha-ta | student-hi | panchayat-hi` (persona phone becomes the session, so web + IVR + SMS share one history). "
        "Degraded service is still `success:true` with `source: \"fallback\"` or `\"cache\"`.",
        "",
        "## Frontend tab -> endpoint",
        "",
        "| Tab | Endpoints |",
        "|---|---|",
        "| 1 Voice web app (`/voice`) | `POST /api/chat`, `POST /api/voice-chat`, `GET /api/profile`, `GET /api/stream/events` |",
        "| 2 IVR simulator (`/ivr`) | `POST /api/ivr-simulate`, `GET /api/stream/events` |",
        "| 3 SMS simulator (`/sms`) | `POST /api/sms-simulate` |",
        "| 4 Eligibility (`/eligibility`) | `POST /api/eligibility`, `GET /api/schemes`, `POST /api/profile` |",
        "| `/live` projector | `GET /api/stream/events` |",
        "| Top bar | `GET /api/health`, `POST /api/demo/reset` |",
        "| RAG :8000 (Node only) | `POST /rag/query`, `POST /rag/ingest`, `GET /health` (contract section 9) |",
        "",
        "## SSE: `GET /api/stream/events`",
        "",
        "```",
        f"curl -N {BASE}/api/stream/events",
        'data: {"type":"hello","channel":"web","clients":1,"ts":"..."}',
        'data: {"type":"transcript","channel":"web","speaker":"user","text":"पीएम किसान ...","ts":"..."}',
        'data: {"type":"pipeline","step":"chroma_rag_retrieved","ms":48,"channel":"web","ts":"..."}',
        'data: {"type":"pipeline","step":"groq_llm_synthesized","ms":17,"mode":"extractive","channel":"web","ts":"..."}',
        'data: {"type":"pipeline","step":"sms_receipt_dispatched","ms":0,"channel":"web","text":"पीएम-किसान: ...","ts":"..."}',
        'data: {"type":"dtmf","channel":"ivr","phone":"+91...","digit":"1","ts":"..."}',
        'data: {"type":"sms","channel":"sms","phone":"+91...","direction":"out","text":"...","mode":"keyword","delivery":"simulated","ts":"..."}',
        ": heartbeat   (every 15 s)",
        "```",
        "",
        "Unnamed `data:` events with a `type` field (contract section 6), so `EventSource.onmessage` receives all of them. "
        "Pipeline steps: `audio_normalized`, `sarvam_stt_done` (only with Sarvam), `chroma_rag_retrieved`, `groq_llm_synthesized` (`mode` says llm or extractive), `sarvam_tts_ready` (only with Sarvam), `sms_receipt_dispatched`.",
        "",
        "## Endpoints (real calls)",
        "",
    ]
    for title, method, path, tab, curl, status, ms, payload, note in SECTIONS:
        lines += [f"### {title} — `{method} {path.split('?')[0]}`", "", f"Used by: {tab}. HTTP {status}, {ms} ms." + (f" {note}" if note else ""), "",
                  "```bash", curl, "```", "", "```json", json.dumps(shorten(payload), ensure_ascii=False, indent=2), "```", ""]
    lines += ["Also: `GET /api/docs` (Swagger UI + table), `GET /api/docs/openapi.json`, `POST /api/schemes/ingest`, "
              "`POST /api/cloudtalk/voice/dtmf-category`, `POST /api/cloudtalk/voice/process-speech` (same IvrStep as the simulator).", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT} ({len(SECTIONS)} calls)")


if __name__ == "__main__":
    main()
