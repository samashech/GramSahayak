# Demo script & judge playbook (LD-06)

All timings below were measured on the demo stack (Supabase + real RAG, extractive mode). Simulated parts are said out
loud as simulated (DR-02 honesty rule).

## Before judges arrive (5 min checklist)

- [ ] `bash scripts/start-demo.sh` → health table shows `Database postgres ok=True`, `RAG ok=True vectors=45`.
- [ ] `bash scripts/e2e.sh` → `21/21 passed`. Then **Reset demo** in the top bar (or `curl -X POST localhost:5000/api/demo/reset`).
- [ ] Two browser windows side by side: **left** `http://localhost:3000/ivr`, **right** `http://localhost:3000/live` (dark projector view).
- [ ] Third tab: `/voice`, fourth: `/sms`, fifth: `/eligibility`. Zoom 125%. Notifications off. Volume up. Charger in.
- [ ] Phone hotspot ready. Backup video on the laptop desktop.
- [ ] If venue Wi-Fi is bad: restart with `bash scripts/start-demo.sh --sqlite` (DR-04). If RAG misbehaves: `--mock-ai` (golden cache).

## Opening story (0:00-0:30)

"Meet **Ramesh Kumar**, a farmer with 1.2 hectares in Rajasthan. No mobile data at the field, and government
forms are in English. GramSahayak lets him **call, speak, or SMS** in Hindi, Marathi or Tamil, and every answer
comes from verified scheme cards, never from a model's guess."

## 3-minute speed pitch

| Time | Presenter says | Clicker does | Judges see |
|---|---|---|---|
| 0:30 | "Watch a call live. This is our browser phone (a **simulated** toll-free line); the right screen is the live pipeline." | `/ivr`: press **Call** | Multilingual greeting, `/live` shows IVR CALL + masked caller |
| 0:45 | "Ramesh presses 1 for Hindi, then 1 for schemes." | press **1**, then **1** | Big DTMF digits on `/live` |
| 1:00 | "He asks: who is eligible for PM-KISAN?" | tap the **PM-KISAN** question chip (or type it) | Transcript appears, pipeline bars fill (retrieval ~50 ms, total well under the 4.5 s budget) |
| 1:15 | "The answer is spoken, and the official card is sent by SMS — portal, helpline, documents. Copied verbatim from the card, never written by AI. Delivery here is **simulated**." | — | SMS receipt card on `/live` and the toast on `/ivr` |
| 1:35 | "Eligibility is never guessed. Same family, deterministic rules." | `/eligibility` → **G6 preset** → Check | **8 eligible** schemes, 5 not eligible with plain reasons |
| 2:05 | "No smartphone? Plain SMS works." | `/sms` → **PMKISAN** chip | Reply in ~150 ms, ≤160 chars, keyword badge, delivery `simulated` |
| 2:25 | "Safety first." | `/voice` → **सांप ने काट लिया** chip | Red banner with tap-to-call **108**; no home remedies |
| 2:45 | "And if the AI service goes down mid-demo…" (optional) | — | (see 5-minute version) |
| 2:55 | Close: "One gateway, three channels, zero guessed eligibility." | — | — |

## 5-minute deep dive (adds to the above)

| Time | Show | Point |
|---|---|---|
| 3:00 | `/voice` in **Tamil**, Kavitha (ASHA) preset, chip **JSY** | Same answer path in Tamil; source pill says **verified ground truth** |
| 3:30 | Terminal: `bash scripts/e2e.sh --kill-test` (or stop RAG) | Every golden query still answers (`local fallback` / `cached response`), `/api/health` shows `rag.ok:false`, RAG restarts → `rag.ok:true` |
| 4:10 | `/voice` → **कीटकनाशक किती टाकू** | Dose refused, Kisan Call Centre 1800-180-1551 offered |
| 4:30 | `http://localhost:5000/api/docs` + `docs/safety-audit.md` | 25 adversarial prompts, emergency+dose 17/17 |
| 4:50 | `?lite=1` on `/voice` | Text-first Lite mode for 2G |

## Failure plan

| Failure | How we notice | Action (≤ 30 s) |
|---|---|---|
| RAG down / slow | `/api/health` rag.ok=false, source pill "local fallback" | Keep going: answers come from cards + golden cache. Say so honestly. |
| Groq / LLM issues | n/a | Demo already runs extractive (DEC-11). |
| Sarvam key missing / quota | no audio from server | Browser speech plays automatically (`useBrowserTts`). |
| Supabase / venue Wi-Fi | health db driver not postgres | Backend auto-falls back to memory; for a clean restart `bash scripts/start-demo.sh --sqlite`. |
| Backend crash | pages show errors | Ctrl-C, `bash scripts/start-demo.sh --mock-ai` (golden cache, no external calls). |
| Mic blocked on judge phone | no recording | Use the question chips / text box (same pipeline). |
| Projector resolution | text too big/small | `/live` is responsive; browser zoom 90-125%. |
| Everything | — | Play the backup video. |

## Roles during the demo

Presenter (story + pitch) · Clicker (follows the table) · Tech answerer (architecture, safety, data) · `/live` watcher (calls out the pipeline numbers).

## Backup video (record once, 2-3 min, 1080p)

Screen + voice-over of the 3-minute script above, both windows visible, ending on the kill test. Keep it on the laptop and a phone.
