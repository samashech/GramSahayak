# GramSahayak — QA, Verification & Webhook Scripts (`/scripts`)

> **Owner:** Team Lead, QA & Demo Owner (`lead`)
> **Single Source of Truth:** [`/docs/api-contract.md`](../docs/api-contract.md) (`contract-v1`)
> **Context & Role Guide:** [`/docs/CLAUDE.md`](../docs/CLAUDE.md) · [`/docs/ROLE.md`](../docs/ROLE.md)

---

## Planned Scripts (By Team Lead Prompt)

| Script | Prompt | Purpose | Target / Inputs |
| :--- | :---: | :--- | :--- |
| `scripts/test-webhooks.sh` | **LD-01** | Simulates CloudTalk Call Flow webhook sequence (`incoming` -> `dtmf` language -> `dtmf` category -> `process-speech`) and `sms/incoming` (`PMKISAN`) via `curl`, printing `PASS`/`FAIL` by checking `success: true`. | Node Gateway (`http://localhost:5000`) |
| `scripts/fact_check_report.py` | **LD-02** | Reads `/data/seed/schemes.json` and the 3 guides (`agri.md`, `health.md`, `education.md`) to generate CSV and Markdown human fact-check & native-speaker localisation worksheets, flagging any `sms_summary` > 160 chars. | `/data/seed/*` |
| `scripts/e2e.sh` | **LD-03** | End-to-end integration & P0 verification harness against the Node Gateway for golden queries (`G1`–`G8`) and safety checks (`S1`–`S3`), printing `PASS`/`FAIL`, latency (`ms`), and `source` (`rag \| cache \| fallback`). | Node Gateway (`http://localhost:5000`) |

---

## Script Conventions & Safety Rules

1. **Exit Codes:** Every test/verification script (`test-webhooks.sh`, `e2e.sh`, `fact_check_report.py`) must exit `0` when all checks pass and non-zero (`1`) on any P0 failure.
2. **Zero Secrets:** Never hardcode API keys, tokens, or database URLs inside `/scripts`. Read configuration from environment variables (`API_URL`, `.env`) with safe local defaults (`http://localhost:5000`).
3. **Boundary Rule (`R1`):** End-to-end scripts test the public/gateway surface on `:5000` (complementing `cd backend && npm test` and `python3 rag/eval/run_eval.py`).
