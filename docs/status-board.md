# GramSahayak — Live Status Board, Checkpoints & Cut List (`LD-05`)

> **Owner:** Team Lead (`lead`) · **Live Since:** `H0-1` (`2026-10-31`)
> **Single Source of Truth:** [`/docs/api-contract.md`](api-contract.md) (`contract-v1`)
> **Decisions & CCR Log:** [`/docs/decisions.md`](decisions.md)

---

## 1. 24-Hour Checkpoints (`H1` to `H23`)

| Checkpoint | What Must Work | Verifier | Exact Verification Command / Click Path | Decision If It Fails |
| :---: | :--- | :---: | :--- | :--- |
| **`H1`**<br>*(Setup Freeze)* | Contract frozen (`contract-v1`); monorepo & branches live; DB schemas (`DB-02`), Backend gateway + 13 seed cards (`A-00`, `K-01..K-04`, `B-01`, `B-02`), RAG `/health` (`RAG-01`), Frontend shell + mocks (`FE-01`, `FE-02` in `/frontend`), Lead runbook + board (`LD-01`, `LD-05`) ready. | **Team Lead** | ```bash\ngit tag -l contract-v1\npython3 db/init_sqlite.py\ncd backend && npm test\ncurl -s http://localhost:5000/api/health\ncurl -s http://localhost:8000/health\n``` | **Reassign / Fix immediately:** Hold PR merge for any branch violating folder ownership (e.g., `FE-01/02` root files -> move into `/frontend`). Do not advance role until `H1` check is green. |
| **`H4`**<br>*(Core Foundation)* | Frontend runs on mocks (`:3000`, `/eligibility` `FE-03`); Backend seed loader, personas, profile & deterministic eligibility (`B-03..B-05`) pass tests on `:5000`; DB seed validator & personas (`DB-03`, `DB-05`) pass; RAG schema-first ingest & `/rag/query` (`RAG-02`, `RAG-03`) answer `G1`; Lead `LD-02` worksheet generated. | **Team Lead + Rotating Integrator** | ```bash\npython3 db/validate_seed.py data/seed/schemes.json\npython3 db/seed_db.py --check\ncd backend && npm test\ncurl -s -X POST http://localhost:5000/api/eligibility -H "Content-Type: application/json" -d '{"profile":{"occupation":"farmer","land_hectares":1.0,"bpl":true,"age":35,"gender":"female","pregnant":false,"annual_income":90000,"social_category":"obc"},"languageCode":"hi-IN"}'\n``` | **Extend max 30 min or Fallback:** If `DB-05` `demo_personas.json` is late, Backend uses Contract §12 fallback (`demoPersonas.fallback.js`). If Chroma ingest fails, run with `schemes.json` chunks first. |
| **`H6`**<br>*(Telephony Gate)* | Inbound CloudTalk trial number + Cloudflare HTTPS tunnel verified, OR cut rule triggered; `RAG-03` passes 6 golden queries (`G1–G5, G7`); `DB-04` Supabase `:6543` pooler or SQLite fallback verified. | **Team Lead (`LD-01`)** | ```bash\nbash scripts/test-webhooks.sh\npython3 db/check_connection.py\n``` | **Cut Decision (`DR-03` & `DR-04`):** If no working inbound number at `H6`, **cut live phone call**, keep Tab 2 & Tab 3 browser simulators as primary, and record 1 backup call video. If Supabase fails >10 min, lock `DB_DRIVER=sqlite`. |
| **`H8`**<br>*(Standalone Services)* | Every service works standalone: FE Tabs 1, 2, 3, 4 on mocks (`FE-03..FE-06`); Backend `agentBrain` + Sarvam + IVR/SMS routes (`B-06, B-07`); RAG safety + extractive fallback + eval harness (`RAG-04..RAG-06`); Lead test plan (`LD-03`) ready. | **All Role Owners + Lead** | ```bash\ncd backend && npm test\npython3 rag/eval/run_eval.py\nbash scripts/test-webhooks.sh\n``` | **First Cut Decision:** Cut Item 1 (Swagger UI & extra SSE polish) and Item 2 (Lite mode service worker) if FE or BE is >45 min behind schedule. |
| **`H12`**<br>*(Integration)* | Frontend connected to live Backend (`NEXT_PUBLIC_USE_MOCKS=false`, `FE-07` `/live` SSE + `FE-08`); Backend SSE + `/docs/endpoint-map.md` (`B-08, B-09`); RAG latency tuned (`RAG-07`); Lead `LD-02` human fact-check PR merged into `/data/seed`. | **Team Lead (`LD-03`)** | ```bash\nbash scripts/e2e.sh\n``` | **Second Cut Decision:** Cut Item 3 (languages beyond `hi-IN`, `mr-IN`, `ta-IN`, `en-IN`) and Item 5 (live Groq if rate-limited -> force extractive + golden-8 cache). |
| **`H16`**<br>*(Working Demo)* | One full end-to-end journey passes across Voice Web, IVR Simulator, SMS Simulator, Eligibility Checker, and `/live` projector screen; `LD-04` safety audit passes 100% of emergency/dose rows; DB snapshot (`DB-06`) taken. | **Team Lead** | ```bash\nbash scripts/e2e.sh\npython3 rag/eval/run_eval.py\npython3 db/snapshot.py\ngit tag -a v0-working-demo -m "H16 working demo"\n``` | **Freeze Scope:** Reassign anyone whose component is done to fix open `S1` (demo-breaking) bugs before tagging `v0-working-demo`. |
| **`H20`**<br>*(Feature Freeze)* | **FEATURE FREEZE.** `FE-09` Lite/a11y, `B-10` golden cache, `RAG-08` deploy/kill-test complete. Zero new features after `H20`. | **Team Lead** | Kill-test RAG (`stop :8000` -> `POST /api/chat` returns `source: "fallback" \| "cache"`, `/api/health` shows `rag.ok: false`). | Drop any unfinished `P1`/`S3` items immediately; pivot 100% of team to deployment (`FE-10`, `B-11`), rehearsals (`LD-06`), and pitch (`LD-07`). |
| **`H22`**<br>*(Code Freeze & Go/No-Go)* | **CODE FREEZE** (except `S1` showstoppers). Public URLs verified on phone (`FE-10`, `B-11`); 3 demo rehearsals under 3 min (`LD-06`); backup 1080p video recorded; final DB snapshot (`DB-06`); `README.md` & submission package (`LD-08`) complete. | **Team Lead (`LD-08`)** | ```bash\nbash scripts/e2e.sh\npython3 rag/eval/run_eval.py\npython3 db/validate_seed.py data/seed/schemes.json\npython3 db/demo_reset.py --check\ngit tag -a v1-submission -m "H22 final submission"\n``` | **Break-Glass Activation:** If cloud deploy or venue Wi-Fi is unstable, run full stack on demo laptop over phone hotspot + Cloudflare tunnel and present with preloaded tabs + backup video ready. |

---

## 2. Live Feature Status Board (Updated at `H0-1` Integration)

Legend: `DONE` = merged & verified · `WIP (branch)` = pushed on role branch · `MOCK` = working with contract mocks · `QUEUED` = scheduled for next window

| Feature | FE (`:3000`) | BE (`:5000`) | RAG (`:8000`) | DB (`/db`) | Integrated (`dev`) | Tested | Demo-Ready |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Repo, Contract v1 & Schemas (`H0-1`)** | `WIP` (`origin/frontend` — needs `/frontend` folder move) | `DONE` (`A-00, K-01..04, B-01, B-02`) | `DONE` (`RAG-01` `/health`) | `DONE` (`DB-01, DB-02` Postgres & SQLite) | `DONE` (`dev`) | `PASS` | `YES` |
| **1. Voice Web App (`/voice`)** | `WIP` (`FE-01/02` shell + mocks; `FE-05` in H4–10) | `QUEUED` (`B-06` in H4–10) | `WIP` (`RAG-01` live; `RAG-02/03` in H1–4) | `DONE` (`sessions`, `interaction_logs`) | `QUEUED` (`H10`) | `QUEUED` | `NO` |
| **2. IVR Phone Simulator (`/ivr`)** | `WIP` (`FE-02` mock stages; `FE-06` in H4–10) | `QUEUED` (`B-07` in H4–10) | `WIP` (`RAG-01` live) | `DONE` (`sessions`) | `QUEUED` (`H10`) | `QUEUED` | `NO` |
| **3. Offline SMS Simulator (`/sms`)** | `WIP` (`FE-02` mock; `FE-04` in H4–10) | `WIP` (`B-05` SMS parser ready on `origin/backend`) | `WIP` (`RAG-01` live) | `DONE` (`schemes` + 13 seed cards) | `QUEUED` (`H4`) | `WIP` (BE unit tests pass) | `NO` |
| **4. Deterministic Eligibility (`/eligibility`)** | `WIP` (`FE-02` mock; `FE-03` in H1–4) | `WIP` (`B-05` engine ready on `origin/backend`) | *N/A (`R4` deterministic)* | `DONE` (`user_profiles`, `schemes`) | `QUEUED` (`H4`) | `WIP` (BE unit tests pass) | `NO` |
| **5. `/live` Projector Screen (SSE)** | `WIP` (`FE-02` mock timer; `FE-07` in H10–15) | `QUEUED` (`B-08` in H10–15) | *N/A* | *N/A* | `QUEUED` (`H12`) | `QUEUED` | `NO` |
| **6. Real CloudTalk Call & Webhooks** | *N/A* | `QUEUED` (`B-07` in H4–10) | *N/A* | `DONE` (`interaction_logs`) | `WIP` (`LD-01` runbook + `test-webhooks.sh`) | `QUEUED` (`H6` gate) | `BONUS` |
| **7. Safety & Hallucination Guardrails** | `WIP` (`FE-02` `S1` mock fixture) | `QUEUED` (`B-06` safety routing) | `QUEUED` (`RAG-04` in H4–10) | *N/A* | `QUEUED` (`H15` `LD-04`) | `QUEUED` | `NO` |
| **8. Lite Mode & Accessibility** | `QUEUED` (`FE-09` in H15–20) | `QUEUED` (`B-10` cache in H15–20) | `QUEUED` (`RAG-05` extractive in H4–10) | `DONE` (SQLite/memory fallback) | `QUEUED` (`H16`) | `QUEUED` | `NO` |
| **9. Cloud / Tunnel Deploy** | `QUEUED` (`FE-10` in H20–24) | `QUEUED` (`B-11` in H20–24) | `QUEUED` (`RAG-08` in H15–20) | `QUEUED` (`DB-04` in H4–10) | `QUEUED` (`H21`) | `QUEUED` | `NO` |

---

## 3. Ordered Project Cut List (Cut in Exact Order When Behind)

When any checkpoint slips by more than 30 minutes, the **Team Lead** triggers cuts in this strict order and logs the entry in [`/docs/decisions.md`](decisions.md):

1. **Cut #1:** Swagger UI (`/api/docs`) and extra SSE visual polish.
2. **Cut #2:** Lite mode bundle optimization (`<=25 KB` target) and offline Service Worker (`FE-09`).
3. **Cut #3:** All languages beyond the 3 featured demo languages (`hi-IN`, `mr-IN`, `ta-IN` + `en-IN`).
4. **Cut #4:** The live CloudTalk phone call *(keep Tab 2 IVR Simulator and Tab 3 SMS Simulator as the primary demo path + 1 backup call video)*.
5. **Cut #5:** Live Groq LLM generation *(switch to `MOCK_LLM=true` / RAG extractive mode + Node golden-8 demo cache)*.
6. **Cut #6:** Cloud Supabase Postgres *(switch to `DB_DRIVER=sqlite` using `data/gram_sahayak.sqlite`)*.

### NEVER CUT (Protected Core)
- **SMS keyword path** (`PMKISAN`, `JSY`, `NSP`, `HELP`, etc. returning verbatim `sms_summary` in `<300 ms`).
- **Deterministic eligibility engine (`R4`)** (`POST /api/eligibility` against `data/seed/schemes.json`).
- **Golden-8 demo cache** (guarantees instant fallback if Wi-Fi/APIs fail during judging).
- **Medical & agricultural safety guardrails** (`108`, `102`, `104`, `1800-180-1551`, zero pesticide/medicine doses).
- **Root `README.md` & on-time submission** (`>=60` minutes before deadline).

---

## 4. Team Cadence, Standup Template, Rotation & Rest Schedule

### 5-Minute Checkpoint Standup Template (Post in Team Chat at `H1, H4, H8, H12, H16, H20, H22`)
```text
ROLE: <fe | be | rag | db | lead>   CHECKPOINT: <H..>   BRANCH: <feat/...>
DONE: <prompts/tasks merged or ready>
DOING NEXT (next 2-3h): <prompt ID + deliverable>
BLOCKED BY (>20 min = ESCALATE NOW): <none | specific endpoint/file/env needed from whom>
CONTRACT CHANGE REQUESTS: <none | CCR-# summary>
RISKS: <none | latency / quota / Wi-Fi / UI issue>
```

### Escalation Rule
- **20-Minute Blocker Rule:** Any teammate blocked for more than **20 minutes** on a bug, environment issue, or missing hand-off **must stop and escalate to the Team Lead immediately**. The Lead either pairs to unblock within 10 minutes or triggers the documented fallback/cut rule.

### Rotating 4-Hour Integration Owner Schedule
Every 4 hours, the designated Integration Owner pulls all ready PRs into `dev`, runs the verification suite (`npm test`, `init_sqlite.py`, `run_eval.py`, `scripts/e2e.sh`), and posts the output on the board:

| Window | Integration Owner | Primary Verification Focus |
| :---: | :--- | :--- |
| `H0–H4` | **Team Lead (Sameer)** | `H1` & `H4` checkpoints: `DB-01/02`, `B-01..05`, `RAG-01..03`, `FE-01..03` folder structure & schema parity |
| `H4–H8` | **Backend Lead + Team Lead** | `H6` CloudTalk gate, `DB-04` Supabase/SQLite check, `B-06/B-07` <-> `RAG-03/04` contract check |
| `H8–H12` | **Database Engineer (Ayush)** | `H12` full integration merge into `dev`, seed validation (`DB-03`), demo reset parity (`DB-05`) |
| `H12–H16` | **RAG Engineer (Pranav)** | `H16` `v0-working-demo` tag: `RAG-06/07` golden eval + latency budget (`p95 <= 1500 ms`) + `scripts/e2e.sh` |
| `H16–H20` | **Frontend Engineer (Ujjwal)** | `H20` Feature Freeze: `FE-08/09` mobile 360px + CORS + SSE `/live` + RAG kill-test (`RAG-08`) |
| `H20–H24` | **Team Lead (Sameer)** | `H22` `v1-submission` tag, `H22:30` Go/No-Go checklist, 3 demo rehearsals, final submission upload (`H23`) |

### Staggered Rest Schedule (Keep Speakers & Drivers Sharp for `H20–H24`)
- **`H10–H12` (Power Nap Slot A — 90 min):** Database + RAG rest while Frontend & Backend complete initial API wiring (`FE-07/08`, `B-08/09`).
- **`H13–H15` (Power Nap Slot B — 90 min):** Backend + Frontend rest while Team Lead, DB, and RAG run `LD-03` e2e matrix, `DB-06` snapshot, and `RAG-07` latency tuning.
- **`H17–H18:30` (Power Nap Slot C — 90 min):** Team Lead (pitch speaker) rests after `v0-working-demo` tag (`H16`) so presenters are 100% fresh for `H20–H24` rehearsals and judging Q&A.

---

## 5. Hour-0 (`H1` Checkpoint) Prompt Verification Audit

| Role & Prompt | Branch / Commit | Contract Compliance Check | Verification Result |
| :--- | :--- | :--- | :---: |
| **DB (`DB-01`)** Repo, Contract v1, Git protocol | `origin/dev` (`f2c90a9`, tag `contract-v1`) | `/docs/api-contract.md`, `.gitignore`, `.env.example`, `README.md`, `ROLE.md`, `docs/team-protocol.md`, PR/CCR templates present. | **PASS (Merged in `dev`)** |
| **DB (`DB-02`)** Postgres & SQLite schemas | `origin/feat/db-setup` (`4aef4e7`) | `db/schema.postgres.sql`, `db/schema.sqlite.sql`, `db/init_sqlite.py`, `db/README.md` match Contract §5 (`sessions, user_profiles, interaction_logs, schemes`, 0 diff vs `B-02`). | **PASS (Merged in `dev`)** |
| **BE (`A-00`, `K-01..04`, `B-01`, `B-02`)** Contract align, 13 seed cards, gateway & DB adapter | `origin/dev` (`bfb7ea4`) + `f605b09` | 13 scheme cards (`PMKISAN..PRAGATI`) with 4-lang `sms_summary` `<=160` chars; `dbAdapter.js` supports `postgres \| sqlite \| memory` and applies `db/schema.sqlite.sql`; `GET /api/health` returns Contract §6 envelope. | **PASS (Merged in `dev`)** |
| **RAG (`RAG-01`)** FastAPI scaffold, schemas & `/health` | `origin/rag` (`913c243`) | `rag/app/{main.py,config.py,schemas.py,rag.py,llm.py,prompts.py,safety.py}`, `GET /health` returns `{status, vector_count, embedding_model, mode}`, validates vocabulary on `/rag/query`. | **PASS (Merged in `dev`)** |
| **Lead (`LD-01`, `LD-05`)** CloudTalk runbook, webhook test script, status board | `feat/lead-setup` | `docs/CLAUDE.md`, `docs/ROLE.md`, `docs/decisions.md`, `docs/status-board.md`, `docs/cloudtalk-runbook.md`, `scripts/test-webhooks.sh` complete inside `/docs` & `/scripts`. | **PASS (Merged in `dev`)** |
| **FE (`FE-01`, `FE-02`)** Next.js shell, 4 tabs, `/live`, i18n, typed client, mocks | `origin/frontend` (`e54193c`) | App shell, `AppContext`, `lib/types.ts`, `lib/api.ts`, and `mocks/*.json` match Contract §6/§12, **BUT** files were committed at repo root (`/app`, `/components`, `/lib`, `/package.json`) instead of `/frontend/*`. | **HOLD MERGE (Action sent to FE: move into `/frontend/`)** |
