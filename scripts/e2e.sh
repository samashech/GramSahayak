#!/usr/bin/env bash
# GramSahayak end-to-end suite (LD-03) against the running Node gateway.
#   bash scripts/e2e.sh [BASE_URL]               # default http://localhost:5000
#   bash scripts/e2e.sh --kill-test [BASE_URL]   # also: stop RAG :8000, re-run P0 rows (must be
#                                                # fallback/cache), check rag.ok=false, restart RAG, check recovery
# Uses only the 5 demo personas' sessions and ends with POST /api/demo/reset (no stray rows).
# Exit 0 only if every P0 row passes.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KILL=0
BASE="http://localhost:5000"
for a in "$@"; do
  case "$a" in
    --kill-test) KILL=1 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) BASE="$a" ;;
  esac
done
export E2E_BASE="$BASE" E2E_ROOT="$ROOT" E2E_KILL="$KILL"

exec python3 -I - <<'PY'
import json, os, signal, subprocess, sys, time, urllib.error, urllib.request

BASE, ROOT, KILL = os.environ["E2E_BASE"].rstrip("/"), os.environ["E2E_ROOT"], os.environ["E2E_KILL"] == "1"
GOLDEN = json.load(open(f"{ROOT}/data/seed/golden_queries.json", encoding="utf-8"))["queries"]
PERSONAS = {p["id"]: p for p in json.load(open(f"{ROOT}/data/seed/demo_personas.json", encoding="utf-8"))}
G6_EXPECTED = {"PMKISAN", "PMFBY", "KCC", "SHC", "PMJAY", "MGNREGA", "UJJWALA", "PMAY"}
rows = []


def call(method, path, body=None, headers=None):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            status, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    except Exception as e:  # connection refused etc.
        return 0, int((time.perf_counter() - t0) * 1000), {"error": str(e)}
    ms = int((time.perf_counter() - t0) * 1000)
    try:
        return status, ms, json.loads(raw)
    except ValueError:
        return status, ms, {}


def record(rid, endpoint, status, ms, source, ok, why=""):
    rows.append((rid, endpoint, status, ms, source or "-", ok, why))


def check(rid, endpoint, status, ms, env, cond, why, source=None):
    ok = status == 200 and env.get("success") is True and cond
    record(rid, endpoint, status, ms, source, ok, "" if ok else why)
    return ok


def golden_rows(tag="", allow_sources=None):
    for q in GOLDEN:
        lang = q["original"]
        s, ms, env = call("POST", "/api/chat", {"queryText": q["text"][lang], "languageCode": lang, "category": q["category"], "role": q["role"]},
                          {"x-demo-user": q["persona"]})
        d = env.get("data") or {}
        exp = q["expect"]
        cond = d.get("matchedSchemeId") == exp["matched"] and (d.get("safety") or {}).get("flagged") == exp["safety"]
        why = f"matched={d.get('matchedSchemeId')} want {exp['matched']}; safety={(d.get('safety') or {}).get('flagged')} want {exp['safety']}"
        if exp["matched"]:
            cond = cond and (d.get("smsReceipt") or {}).get("smsReceiptText") is not None
        if allow_sources:
            cond = cond and d.get("source") in allow_sources
            why += f"; source={d.get('source')} want {'/'.join(allow_sources)}"
        check(q["id"] + tag, f"/api/chat {lang}", s, ms, env, cond, why, d.get("source"))


def rag_pid():
    out = subprocess.run(["ss", "-ltnpH", "sport = :8000"], capture_output=True, text=True).stdout
    for part in out.split("pid=")[1:]:
        return int(part.split(",")[0])
    return None


def main():
    s, ms, env = call("GET", "/api/health")
    d = env.get("data") or {}
    check("H1", "/api/health", s, ms, env, (d.get("db") or {}).get("ok") is True,
          "db not ok", f"db={(d.get('db') or {}).get('driver')} rag={(d.get('rag') or {}).get('ok')}")

    golden_rows()

    s, ms, env = call("POST", "/api/eligibility", {"profile": {"occupation": "farmer", "land_hectares": 1.0, "bpl": True, "age": 35, "gender": "female",
                                                                "pregnant": False, "annual_income": 90000, "social_category": "obc"}, "languageCode": "hi-IN"})
    elig = {x["code"] for x in (env.get("data") or {}).get("eligibleSchemes", [])}
    check("G6", "/api/eligibility", s, ms, env, elig == G6_EXPECTED, f"eligible={sorted(elig)}")

    ramesh = PERSONAS["farmer-hi"]["phone"]
    call("POST", "/api/sms-simulate", {"fromPhone": ramesh, "body": "HELP"})  # warm the DB connection
    s, ms, env = call("POST", "/api/sms-simulate", {"fromPhone": ramesh, "body": "PMKISAN"})
    d = env.get("data") or {}
    check("G8", "/api/sms-simulate", s, ms, env,
          d.get("mode") == "keyword" and d.get("matchedSchemeId") == "PMKISAN" and d.get("charCount", 999) <= 160 and ms < 300 and d.get("delivery") == "simulated",
          f"mode={d.get('mode')} chars={d.get('charCount')} {ms}ms delivery={d.get('delivery')}", d.get("mode"))

    caller = PERSONAS["asha-ta"]["phone"]
    flow = [("greeting", {}, "greeting"), ("language", {"dtmfDigit": "1"}, "language"), ("category", {"dtmfDigit": "1"}, "category"),
            ("speech", {"text": GOLDEN[0]["text"]["hi-IN"]}, "answer"), ("goodbye", {}, "goodbye")]
    for i, (stage, extra, want) in enumerate(flow, 1):
        s, ms, env = call("POST", "/api/ivr-simulate", {"callerPhone": caller, "stage": stage, **extra})
        d = env.get("data") or {}
        cond = d.get("stage") == want and "webhookLog" in d
        why = f"stage={d.get('stage')} want {want}"
        if want == "answer":
            a = d.get("answer") or {}
            cond = cond and a.get("matchedSchemeId") == "PMKISAN" and (a.get("smsReceipt") or {}).get("delivery") == "simulated"
            why += f"; matched={a.get('matchedSchemeId')}"
        check(f"IVR{i}", f"/api/ivr-simulate {stage}", s, ms, env, cond, why, (d.get("answer") or {}).get("source"))

    hdr = {"x-demo-user": "student-hi"}
    s, ms, env = call("POST", "/api/profile", {"district": "Jaipur"}, hdr)
    check("P1", "POST /api/profile", s, ms, env, ((env.get("data") or {}).get("profile") or {}).get("district") == "Jaipur", "district not saved")
    s, ms, env = call("GET", "/api/profile", None, hdr)
    hist = (env.get("data") or {}).get("history") or []
    check("P2", "GET /api/profile", s, ms, env, ((env.get("data") or {}).get("profile") or {}).get("district") == "Jaipur" and len(hist) >= 2,
          f"history={len(hist)}")
    s, ms, env = call("POST", "/api/demo/reset")
    check("R1", "/api/demo/reset", s, ms, env, len((env.get("data") or {}).get("users", [])) == 5, "users != 5")
    s, ms, env = call("GET", "/api/profile", None, hdr)
    d = env.get("data") or {}
    starter = len(PERSONAS["student-hi"].get("starter_history") or [])
    check("R2", "GET /api/profile after reset", s, ms, env, (d.get("profile") or {}).get("district") is None and len(d.get("history") or []) == starter,
          f"district={(d.get('profile') or {}).get('district')} history={len(d.get('history') or [])} want {starter}")

    if KILL:
        pid = rag_pid()
        if pid:
            os.kill(pid, signal.SIGTERM)
            time.sleep(2)
        s, ms, env = call("GET", "/api/health")
        rag = ((env.get("data") or {}).get("rag") or {})
        check("K0", "/api/health (RAG stopped)", s, ms, env, rag.get("ok") is False, f"rag.ok={rag.get('ok')}", "rag.ok=false")
        golden_rows(tag="-kill", allow_sources=("fallback", "cache"))
        subprocess.Popen(["bash", f"{ROOT}/rag/run.sh"], stdout=open(f"{ROOT}/.demo-logs/rag.log", "a"), stderr=subprocess.STDOUT, start_new_session=True)
        ok, t0 = False, time.time()
        while time.time() - t0 < 180:
            s, ms, env = call("GET", "/api/health")
            if ((env.get("data") or {}).get("rag") or {}).get("ok"):
                ok = True
                break
            time.sleep(2)
        record("K1", "/api/health (RAG restarted)", s, int((time.time() - t0) * 1000), "rag.ok=true" if ok else "-", ok, "" if ok else "RAG did not recover in 180 s")
        call("POST", "/api/demo/reset")

    w = max(len(r[1]) for r in rows)
    print(f"{'ID':<9}| {'Endpoint':<{w}} | Status | Latency  | {'Source':<26} | Result")
    print("-" * (w + 60))
    for rid, ep, st, ms, src, ok, why in rows:
        print(f"{rid:<9}| {ep:<{w}} | {st:<6} | {ms:>5} ms | {str(src)[:26]:<26} | {'PASS' if ok else 'FAIL  ' + why}")
    failed = [r for r in rows if not r[5]]
    print(f"\n{len(rows) - len(failed)}/{len(rows)} passed" + (f", {len(failed)} FAILED" if failed else " - all P0 flows green"))
    sys.exit(1 if failed else 0)


main()
PY
