# GramSahayak — Architectural & Contract Decisions Log (`decisions.md`)

> Maintained by the **Team Lead** (`LD-01`..`LD-08`).
> Every Contract Change Request (CCR), cross-pack conflict resolution, cut-list trigger, and infrastructure fallback decision is recorded here with its timestamp, decision, owner, and rationale.
> Single source of truth remains **[`/docs/api-contract.md`](api-contract.md)** (`contract-v1`).

---

## 1. Standing Decision Rules (Pre-Approved at Hour 0)

| Rule ID | Trigger / Checkpoint | Decision & Action | Owner |
| :--- | :--- | :--- | :--- |
| **DR-01 (Contract Supremacy)** | Any conflict between SRS `.md`, Backend Pack v3, 24H Pack, or local `CLAUDE.md` | `/docs/api-contract.md` (`contract-v1`) wins unconditionally. Any required change goes through a formal Contract Change Request (10-min Lead SLA). | Team Lead (`lead`) |
| **DR-02 (Primary Demo Path)** | Always active | Browser IVR Simulator (Tab 2) and Browser SMS Simulator (Tab 3) are the **primary demo path**; real CloudTalk telephony/SMS is the bonus path (avoids venue cellular drops and Indian DLT blocking). | Team Lead / Frontend / Backend |
| **DR-03 (H6 CloudTalk Cut Rule)** | Hour 6 (`H6`) or >20 min webhook blocker (`E-GS-08`) | If no working inbound CloudTalk number is active by `H6`, drop the live phone call, rely on Tab 2/Tab 3 simulators + `/live` SSE view, and record one real-style call backup video (`LD-01`). | Team Lead (`lead`) |
| **DR-04 (10-Min Supabase Cut Rule)** | `db/check_connection.py` fails for >10 min on venue Wi-Fi (`E-GS-05`) | Switch `DB_DRIVER=sqlite` (`SQLITE_PATH=data/gram_sahayak.sqlite`), run `python3 db/init_sqlite.py && python3 db/seed_db.py && python3 db/demo_reset.py`, and restart `:5000`. | Database (`db`) & Backend (`be`) |
| **DR-05 (RAG Hosting Default)** | `H15–H20` (`RAG-08`) | Default to Option B (run RAG `:8000` + Node `:5000` on the demo laptop and expose Node via Cloudflare HTTPS tunnel so `AI_RAG_URL=http://localhost:8000` avoids 512 MB free-tier OOM on `multilingual-e5-small`). | RAG (`rag`) & Backend (`be`) |

---

## 2. Hour-0 Cross-Pack Conflict Resolutions (Locked in `contract-v1`)

| Date / Hour | ID | Topic | Decision Recorded | Impacted Roles |
| :--- | :---: | :--- | :--- | :--- |
| `2026-10-30 H0` | `DEC-01` | Prototype SRS vs Backend Pack v3 | Ignore single-FastAPI + Twilio SRS wording. Build 3 services (`:3000` Next.js, `:5000` Node gateway, `:8000` stateless FastAPI RAG) + CloudTalk webhooks & browser simulators. | All |
| `2026-10-30 H0` | `DEC-02` | Canonical RAG endpoint | `POST /rag/query` is canonical (`POST /rag/retrieve` is optional). Node calls `/rag/query` only with a `4000 ms` timeout before falling back. | `be`, `rag` |
| `2026-10-30 H0` | `DEC-03` | Deterministic eligibility rule keys | Use `K-04` keys: `occupations, max_land_hectares, bpl_only, gender, pregnant_only, min_age, max_age, max_annual_income, social_categories`. | `be`, `db`, `fe` |
| `2026-10-30 H0` | `DEC-04` | `sms_summary` languages & 13 cards | `sms_summary` is an object keyed `en-IN`, `hi-IN`, `mr-IN`, `ta-IN` (`<=160` chars each, verbatim from card). Seed expanded from 10 to **13 cards** adding education schemes `NSP`, `PMYASASVI`, `PRAGATI`. | `be`, `db`, `rag`, `fe`, `lead` |
| `2026-10-30 H0` | `DEC-05` | Profile `social_category` & `annual_income` | Profile uses `social_category` (`general \| obc \| sc \| st`) to avoid clashing with scheme `category`, and includes `annual_income` (INR/yr). | `be`, `db`, `fe` |
| `2026-10-30 H0` | `DEC-06` | Two-stage IVR flow | `POST /api/cloudtalk/voice/dtmf-category` and `/api/ivr-simulate` use `stage: "language"` (digits 1–3) then `stage: "category"` (digits 1–4). Invalid digit re-prompts twice, then defaults to `hi-IN` / `schemes`. | `be`, `fe`, `lead` |
| `2026-10-30 H0` | `DEC-07` | 5 Demo personas (`demo_personas.json`) | Standardize 5 judge presets (`farmer-hi`, `farmer-mr`, `asha-ta`, `student-hi`, `panchayat-hi`) in `/data/seed/demo_personas.json`. | `db`, `be`, `fe`, `lead` |
| `2026-10-30 H0` | `DEC-08` | Turn speaker vs persona role | Stored session turn uses `speaker: "user" \| "assistant"`; Node maps to RAG `{role, content}` (last 6 turns) at the `:8000` boundary. | `be`, `rag`, `db`, `fe` |

---

## 3. Contract Change Requests (CCR) Log

> Copy the template from [`/docs/api-contract.md`](api-contract.md) or `.github/ISSUE_TEMPLATE/contract_change_request.md`. Lead records decision within 10 minutes.

| CCR ID | Date / Hour | From | Summary of Request | Lead Decision | Rationale / Action |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `CCR-01` | `2026-10-30 H0:45` | `be` (`K-04` notes) | `PMYASASVI` officially covers OBC, EBC, and DNT students, whereas Contract §3 `social_category` vocabulary is fixed to `general \| obc \| sc \| st`. | **Alternative (Keep `v1`)** | Keep `social_category` enum unchanged (`general \| obc \| sc \| st`) so FE/DB/BE schemas do not churn; model `PMYASASVI.rules.social_categories: ["obc"]` for deterministic screening and state the full `"OBC, EBC and DNT"` criterion in `eligibility` text (`docs/seed-verification-notes.md`). |
| `CCR-02` | `2026-10-30 H0:45` | `be` (`K-04` notes) | Appendix `G6` expected list names 5 schemes (`PMKISAN, PMJAY, UJJWALA, MGNREGA, PMAY`), while deterministic rules for a farmer (`1.0 ha`) also match `PMFBY, KCC, SHC` (8 total). | **Approved Clarification (`v1`)** | Per Appendix note (*"eligible includes PMKISAN, PMJAY, UJJWALA, MGNREGA, PMAY... Adjust to seed rules"*), matching all 8 eligible schemes (`PMKISAN, PMFBY, KCC, SHC, PMJAY, MGNREGA, UJJWALA, PMAY`) and excluding `JSY, PMMVY, NSP, PMYASASVI, PRAGATI` is the canonical `G6` expectation. |
| `CCR-03` | *Pending `LD-01`* | `lead` | Confirm real CloudTalk webhook payload field names (`caller_number`, `dtmf_digit`, `recording_url`) once tested in dashboard. | **Open (TBC in `LD-01`)** | Backend `B-07` supports Contract §7 payload keys and aliases until `LD-01` captures live payload screenshots. |
