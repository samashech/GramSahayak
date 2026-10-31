# Pitch deck outline & hard Q&A (LD-07)

Eight slides. Every claim below is something we measured or built; simulated parts are labelled. Add judging criteria and
weights here when announced, and order the emphasis accordingly.

## Slides

1. **GramSahayak (ग्राम सहायक) — government help by call, voice or SMS, in your language**
   - Hook: Ramesh, 1.2 ha farmer, no data at the field, forms in English.
   - Hindi · Marathi · Tamil (+ English); farmers, ASHA workers, Panchayat operators, students.
   - Speaker note (30 s): the story, then "let's watch his call".
2. **Problem**
   - Scheme rules, crop advisories and health guidance are published mostly in English or formal Hindi, online.
   - Feature phones and patchy data are common in villages; helplines are hard to find.
   - Wrong eligibility advice costs families money and trust. (Use a statistic only if we can cite the source.)
3. **Solution — one gateway, three channels**
   - Toll-free call (IVR + DTMF), voice-first web app, offline SMS: all hit the same Node gateway and the same session.
   - Every voice answer ends with an SMS receipt copied verbatim from the scheme card (portal, helpline, documents).
   - Screenshot: `/ivr` + `/live` side by side.
4. **Live demo flow** — the 3-minute script (`docs/demo-script.md`).
5. **Architecture & technical depth**
   - Next.js :3000 → Node gateway :5000 → Python RAG :8000 (LangChain + Chroma, multilingual-e5) + Supabase Postgres.
   - No translation pivot: the regional question goes straight to cross-lingual retrieval (PM-KISAN and JSY match in all 4 languages).
   - Deterministic eligibility engine (13 cards, 9 rule keys); SSE live pipeline; golden cache + local card fallback.
6. **Safety & trust (our USP)**
   - Eligibility only from rules, never an LLM (R4). Emergencies → 108 / 102; pesticide doses refused → 1800-180-1551; medicine doses → 104.
   - Two independent safety layers (RAG + gateway). 25-prompt adversarial audit: 25/25, emergency+dose 17/17.
   - Unknown or fake schemes get "no verified information", never a neighbouring card (found and fixed by our audit).
7. **Feasibility, resilience, cost**
   - Measured: SMS keyword reply ~150 ms; retrieval p95 ~15 ms (extractive); kill test: RAG down → all golden queries still answered.
   - Runs on one laptop (RAG ~0.9 GB RAM); Supabase free tier; SQLite fallback with a 46 ms restore drill.
   - Adding a scheme = one JSON card (validated by `db/validate_seed.py`), live ingest via `POST /api/schemes/ingest`.
8. **Roadmap & ask**
   - Real CloudTalk number + DLT-registered SMS templates; Sarvam speech live; more languages and state schemes; CSC/Panchayat pilots.
   - Team: Frontend · Backend · Database · RAG · Lead. Ask: a district pilot partner and telecom sandbox access.

## 20 likely questions (short, honest answers)

1. **Why not let the LLM decide eligibility?** Thresholds change and LLMs guess numbers. Our rules are a reviewed table; the same input always gives the same, explainable answer (R4).
2. **What if the LLM/RAG is down?** The gateway falls back to the matching scheme card, then a golden cache, then "no verified information + helpline". We show it live with the kill test.
3. **Do you actually use an LLM?** The pipeline supports Groq; for the demo we run RAG in extractive mode because it passed our eval 9/9 while the available Groq models did not (DEC-11).
4. **Why Sarvam and not Bhashini?** Sarvam gives one API for STT (saarika), TTS (bulbul) and translation with Indian voices; the gateway isolates it so a swap is one service file. (Sarvam is integrated but runs only with an API key; without it the browser's speech engine is used.)
5. **How do you handle dialects / code-mixing?** Cross-lingual embeddings (multilingual-e5) match meaning, not exact words; we test the same intent in 4 languages. Dialect coverage beyond that is roadmap.
6. **Is the phone call real?** In the demo the call is a browser simulator running the exact same backend code as the CloudTalk webhooks; the webhooks are tested with `scripts/test-webhooks.sh`. A live number needs KYC/DLT time we did not have.
7. **Is the SMS really sent?** In the demo, delivery is `simulated` and labelled so. Outbound SMS uses the CloudTalk API when credentials are set; Indian commercial SMS needs DLT templates.
8. **What if CloudTalk is down?** The simulators (primary path) don't depend on it; SMS receipts are logged and shown on screen.
9. **How accurate are the answers?** Golden eval: 9/9 rows + cross-lingual 8/8; facts come only from 13 scheme cards and 3 guides that a human must verify (`docs/fact-check-worksheet.md`).
10. **Who verifies the scheme data?** The Lead's fact-check worksheet lists every amount, threshold and helpline with its official source; corrections go through one reviewed PR.
11. **How are new circulars added?** Upload a PDF/MD or JSON card at `POST /api/schemes/ingest`; it is indexed live. Uploaded cards can never override the 13 verified ones.
12. **Privacy?** We store phone/session id, a short history (last 20 turns) and the profile fields the user gives. The browser never sees the database or AI keys; the projector masks numbers.
13. **Cost per query?** Extractive RAG runs locally (no per-query AI cost); Sarvam/Groq/SMS costs apply only when enabled.
14. **Latency?** SMS keyword ~150 ms end to end on Supabase; retrieval p95 ~15 ms; voice budget 4.5 s with STT/TTS.
15. **Offline / no internet?** SMS and the call work without the user's data; on our side SQLite + golden cache keep answering without Supabase or RAG.
16. **Accessibility for low literacy?** Voice-first, pictorial categories, tap-to-call helplines, Lite mode for 2G, ARIA labels.
17. **Why LangChain?** Required by the rules, and it gives us a clean retrieval chain (LCEL) and swappable LLM/embeddings.
18. **What is hardest?** Being honest under failure: every degraded path is labelled (source pill) and still safe.
19. **Scaling beyond 3 languages / 13 schemes?** Cards and guides are data; the embedding model is multilingual; Sarvam covers 11 Indian languages.
20. **What next?** Live number + DLT SMS, Sarvam live voices, state schemes, a district pilot with CSC operators.

## Five hard questions and a safe pivot

- "Your facts may be outdated." → "Yes, so they live in one reviewed file with sources and a validator; the model can't invent them." Show `validate_seed.py`.
- "LLM hallucinations?" → "The model never writes eligibility, amounts in receipts, or emergency advice; our audit checks it." Show `docs/safety-audit.md`.
- "This is just a chatbot." → "It's a phone line and an SMS service with the same brain; watch the call."
- "Why should a government trust this?" → "Deterministic rules, sources on every answer, honest fallbacks, open audit scripts."
- "Is anything faked?" → "Two things are simulated and labelled: telecom call delivery and SMS delivery. Everything else ran live today."
