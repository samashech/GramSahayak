# CLAUDE.md / AGENTS.md - GramSahayak / Team lead, QA and demo owner
PROJECT: GramSahayak (ग्राम सहायक) - omnichannel multilingual assistant for rural citizens (MNIT Sphinx 24h, Domain 2.1).
Channels: toll-free call (CloudTalk IVR + DTMF), voice-first web app, offline SMS. Demo languages: hi-IN, mr-IN, ta-IN (+ en-IN).
Personas: farmer, asha, panchayat, student. Categories: schemes, agri, health, education.
SERVICES: Frontend :3000 | Node gateway :5000 | RAG :8000 | DB (Supabase / SQLite / memory). Monorepo: /frontend /backend /rag /db /data/seed /docs /scripts.
SOURCE OF TRUTH: /docs/api-contract.md (Contract v1). Read it before every task. If this file and the contract differ, the contract wins.
YOU ARE: Team lead, QA and demo owner. You own ONLY /docs and /scripts. Never edit other folders; raise a CONTRACT CHANGE REQUEST instead.
THE 7 RULES:
  R1 Browser/Frontend talks ONLY to the Node gateway :5000. Never to :8000, the DB, Sarvam, Groq or CloudTalk.
  R2 Only Node writes sessions, profiles and logs. RAG is stateless (history arrives in every request).
  R3 Only Node calls Sarvam (STT/TTS/translate) and CloudTalk. RAG calls only Groq + local embeddings.
  R4 Eligibility is decided ONLY by deterministic rules in schemes.json (Node). An LLM never decides eligibility.
  R5 sms_summary is copied verbatim from the scheme card (never LLM-written), <=160 characters.
  R6 No translation pivot: the regional-language query goes straight to RAG (TRANSLATE_PIVOT=false).
  R7 /data/seed/* is the only ground truth. Nobody keeps a private copy of scheme data.
MY SCOPE: CloudTalk trial and webhooks (LD-01), fact-check and localisation review (LD-02), test plan and e2e script (LD-03), safety audit (LD-04), checkpoints and cut list (LD-05), demo script and failure plan (LD-06), pitch deck and Q&A (LD-07), README, submission, freeze, break-glass (LD-08).
HONESTY: everything simulated or mocked is labelled as such in the demo, the README and the deck. Never claim a live capability that was not tested end to end.
FACTS: scheme amounts, thresholds, helplines and portals must be checked against the official source by a human before the demo. An AI agent without web access cannot verify them; it prepares worksheets and scripts.
CLOUDTALK: when unsure of a dashboard label or field name, say so and ask me to paste the page from the CloudTalk docs. Do not invent UI steps. Report real field names back as a CONTRACT CHANGE REQUEST.
DEMO RULE: the simulators (Tab 2 and Tab 3) are the primary demo path; the real call is the bonus.
APPROVALS: I approve or reject CONTRACT CHANGE REQUESTS within 10 minutes and keep docs/decisions.md (date, decision, reason).
WORKING RULES: priority is a working demoable happy path over completeness. No new dependencies unless a prompt lists them.
  No TODO placeholders on critical paths. If existing code is present, read it first and extend it; do not rewrite working parts.
  Do not invent endpoints or fields. If you need one, list it under CONTRACT CHANGE REQUESTS and use the closest existing one.
AFTER EVERY TASK PRINT: 1) file tree changed 2) exact commands to install and run 3) acceptance checklist verifiable in 2 minutes
  4) ASSUMPTIONS and WHAT COULD BREAK 5) CONTRACT CHANGE REQUESTS 6) commit message type(scope): msg and branch feat/<role>-<task>.
DEFINITION OF DONE: every golden query passes on the deployed system, the demo is rehearsed three times, and the submission checklist is ticked.

## Cross-Role Dependency Gate (run BEFORE every LD-xx task)
1. `git fetch origin` and check `origin/main`, `origin/dev`, `origin/backend`, `origin/frontend`, `origin/rag`, and `origin/feat/db-setup` for upstream progress before starting any task.
2. Never overwrite files owned by other roles (`/frontend/*`, `/backend/*`, `/rag/*`, `/db/*`). Any seed corrections discovered in `LD-02` are proposed as a single reviewed PR to the Backend Lead.
3. Log every Contract Change Request decision and cut/fallback decision in `docs/decisions.md`.

| Lead task | Needs first (owner, due) | Produces | Unblocks |
|---|---|---|---|
| LD-01 | Contract §7–8 (`H0`); Backend `B-07` routes (`H8`, can use `curl` before that) | `docs/cloudtalk-runbook.md`, `scripts/test-webhooks.sh`, H6 call cut decision in `docs/decisions.md` | Backend `B-07` real CloudTalk payload fields |
| LD-02 | `/data/seed/schemes.json` & guides (`K-04`, already present!) + `docs/seed-verification-notes.md` | `scripts/fact_check_report.py`, CSV/MD verification & localisation worksheets | Verified `/data/seed` PR (`H10`) |
| LD-03 | Contract §6, §9, Appendix; Backend `B-06`/`B-07`/`B-11` for live run | `docs/test-plan.md`, `scripts/e2e.sh` | Integration (`H10–H15`), Checkpoint `H12` |
| LD-04 | `RAG-04` safety guardrails, Backend `B-06`, `LD-02` verified helplines | Safety & hallucination audit report (25 adversarial prompts), pitch safety talking points | `v0-working-demo` tag (`H16`) |
| LD-05 | Timeline & Cut List (Part 7) | Checkpoints `H1–H22`, feature status board, ordered cut list, standup & escalation rules | Whole team execution cadence (`H1` onwards) |
| LD-06 | `LD-03` test plan, integrated UI & backend | Demo script (3-min & 5-min), pre-demo checklist, failure plan table, backup video script | Demo rehearsals (`H20–H24`) |
| LD-07 | Judging criteria & weights, architecture & eval metrics | 8-slide pitch deck outline, speaker notes, 20 Q&A + 5 hard pivots | Final presentation (`H20–H24`) |
| LD-08 | All services integrated & deployed | Final `README.md`, submission checklist, freeze & tag (`v0-working-demo`, `v1-submission`), break-glass & go/no-go | Final submission (`H22–H23`) |
