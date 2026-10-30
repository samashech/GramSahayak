# GRAMSAHAYAK API CONTRACT v1

Single source of truth: `/docs/api-contract.md`. This file overrides every CLAUDE.md / AGENTS.md in the repo.

Change protocol: post a CONTRACT CHANGE REQUEST -> Lead approves -> owner edits this file and bumps the version -> notify everyone. Frozen after hour 1.

Markers `[NEW]` are shapes the backend pack (v3) never defined; the backend adopts them via prompt A-00.

---

## 1. SERVICES

```
frontend  Next.js 14 App Router        :3000  /frontend  owner: Frontend
backend   Node.js + Express            :5000  /backend   owner: Backend lead
rag       Python FastAPI + LangChain   :8000  /rag       owner: RAG
database  Supabase Postgres | SQLite file | memory+json   /db   owner: Database
shared    /data/seed (ground truth)  /data/raw (uploads)  /docs  /scripts
```

## 2. SEVEN RULES NOBODY BREAKS

- **R1** Browser/Frontend talks ONLY to the Node gateway :5000. Never to :8000, the DB, Sarvam, Groq or CloudTalk.
- **R2** Only Node writes sessions, profiles and logs. RAG is stateless (history arrives in every request).
- **R3** Only Node calls Sarvam (STT/TTS/translate) and CloudTalk. RAG calls only Groq + local embeddings.
- **R4** Eligibility is decided ONLY by deterministic rules in schemes.json (Node). An LLM never decides eligibility.
- **R5** sms_summary is copied verbatim from the scheme card (never LLM-written), <=160 characters.
- **R6** No translation pivot: the regional-language query goes straight to RAG (TRANSLATE_PIVOT=false).
- **R7** /data/seed/* is the only ground truth. Nobody keeps a private copy of scheme data.

---

## 3. VOCABULARY (exact strings, no variants)

```
languageCode    hi-IN | mr-IN | ta-IN (demo) | en-IN ; also te-IN bn-IN gu-IN kn-IN ml-IN pa-IN od-IN
category        schemes | agri | health | education        (IVR digit 1 | 2 | 3 | 4)
role            farmer | asha | panchayat | student
channel         web | ivr | sms
occupation      farmer | agri_labourer | daily_wage | student | homemaker | other
social_category general | obc | sc | st
gender          male | female | other
scheme codes    PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI
sms keywords    the 13 codes + AGRI HEALTH SCHOLARSHIP HELP
helplines       108 ambulance | 102 pregnancy ambulance | 104 health | 1800-180-1551 Kisan Call Centre
                14555 PM-JAY | 155261 PM-KISAN        (Lead verifies every number before the demo)
```

## 4. NAMING

- Data entities (scheme card, profile, turn, DB columns) = **snake_case**.
- Node :5000 request/response fields = **camelCase** (languageCode, answerText, smsReceipt).
- RAG :8000 JSON = **snake_case** (for_voice, matched_scheme_id).
- One idea, three spellings: Node `languageCode` <-> profile/entity `language` <-> RAG `language`. Node maps at the boundary.

---

## 5. DATA MODEL

### Scheme card (`data/seed/schemes.json` = array of 13)

```
{ id, code, name_en, name_hi, name_mr, name_ta,
  category, target_role, benefits, eligibility, exclusions, documents[], how_to_apply,
  helpline, portal_url,
  sms_summary: {"en-IN":"..","hi-IN":"..","mr-IN":"..","ta-IN":".."},   // each <=160 chars, has portal + helpline
  rules: { occupations[]|null, max_land_hectares|null, bpl_only:bool, gender|null, pregnant_only:bool,
           min_age|null, max_age|null, max_annual_income|null, social_categories[]|null } }
```

benefits/eligibility/documents are English in the seed; the backend may translate with Sarvam mayura:v1 and cache. Clients render whatever string arrives.

### Profile (`user_profiles` row, GET/POST /api/profile)

```
{ session_key, phone(E.164|null), role, language, occupation, land_hectares, bpl, age, gender, pregnant,
  annual_income(INR/yr), social_category, state, district, updated_at }
```

### Turn (stored inside `sessions.history`, last 20)

```
{ ts(ISO), channel, speaker:"user"|"assistant", text, category|null, language }
```

### Tables (same names in Postgres, SQLite, and the memory adapter)

```
sessions(session_key PK, phone, history JSON, last_channel, created_at, updated_at)

user_profiles(session_key PK, phone, role, language, occupation, land_hectares, bpl, age, gender, pregnant,
              annual_income, social_category, state, district, updated_at)

interaction_logs(id PK, ts, session_key, phone, channel, event_type, detail JSON, latency_ms, ok)
   event_type: call_incoming | dtmf | stt | answer | sms_in | sms_out | sms_receipt | cache_hit | fallback | error

schemes(code PK, id, name_en, name_hi, name_mr, name_ta, category, target_role, benefits, eligibility, exclusions,
        documents JSON, how_to_apply, helpline, portal_url, sms_summary JSON, rules JSON, updated_at)
```

`session_key` = phone in E.164 (+91...) if known, else the sessionId UUID from the browser.

---

## 6. NODE GATEWAY API (:5000)

### Envelope (every response, errors too)

```
ok : {"success":true,"data":{..},"error":null,"timestamp":"ISO"}
err: {"success":false,"data":null,"error":{"code":"ERR_*","message":".."},"timestamp":"ISO"}
codes: ERR_VALIDATION(400) ERR_NOT_FOUND(404) ERR_STT_FAILED(422) ERR_RATE_LIMIT(429) ERR_INTERNAL(500)
```

Degraded service is NOT an error: the backend answers `success:true` with `source:"cache"` or `"fallback"`.

### Headers on every request

```
x-session-id: <uuid created by the Frontend, kept in localStorage>
optional x-demo-user: farmer-hi | farmer-mr | asha-ta | student-hi | panchayat-hi
```

### Endpoints

```
GET  /api/health        -> {node:{uptimeSec}, db:{driver,ok}, rag:{ok,vectorCount}, sarvam:{configured}, mockMode}
GET  /api/schemes?category=&languageCode=   -> {schemes:[SchemeView]}
POST /api/eligibility   {profile (partial ok), languageCode}
                        -> {eligibleSchemes:[SchemeView], ineligibleSchemes:[{scheme:SchemeView, reason}],
                            totalMatched, recommendedAction}
POST /api/chat          {queryText, languageCode, category?, role, sessionId?}  -> AnswerData
POST /api/voice-chat    multipart: audio(file), role, category?, languageCode? (omit = auto-detect),
                        transcriptHint?, sessionId?
                        -> AnswerData + {transcript, detectedLanguage, audioBase64|null (WAV 22.05 kHz), useBrowserTts}
GET  /api/profile       -> {profile, history:[Turn]}
POST /api/profile       (partial Profile) -> {profile}
POST /api/ivr-simulate  {callerPhone, stage, dtmfDigit?, languageCode?, text?} or multipart (+audio) -> IvrStep
POST /api/sms-simulate  {fromPhone, body, languageCode?}
                        -> {replyText, charCount, matchedSchemeId|null, mode:"keyword"|"rag"|"help", delivery}
GET  /api/stream/events (SSE)  data:{type, step?, ms?, channel, phone?, digit?, text?, ts}
                        heartbeat comment every 15 s
POST /api/demo/reset    -> {reset:true, users:[..]}      (only when DEMO_MODE=true)
POST /api/schemes/ingest  multipart file or JSON card -> {savedPath, ragIngest:{ingested_chunks, vector_count}|null}
POST /api/cloudtalk/voice/incoming | /voice/dtmf-category | /voice/process-speech | /sms/incoming
                        (CloudTalk only; Frontend never calls)
GET  /api/docs          Swagger UI
```

### Shapes

```
SchemeView = {id, code, name (localised), category, targetRole, benefits, eligibility, documents[],
              howToApply, helpline, portalUrl, smsSummary (localised)}
SourceRef  = {id, title, category, helpline, portalUrl}
SmsReceipt = {smsReceiptText, helpline, portalUrl, documents[], delivery:"sent"|"simulated"|"failed"}
[NEW] Safety     = {flagged:boolean, helplines:[string]}
[NEW] AnswerData = {answerText, languageCode, category, matchedSchemeId|null, sources:[SourceRef], smsReceipt|null,
                    safety, source:"rag"|"groq"|"cache"|"fallback", latencyMs}
[NEW] IvrStep    = {stage:"greeting"|"language"|"category"|"speech"|"answer"|"goodbye", promptText, audioBase64|null,
                    useBrowserTts, session:{languageCode, category}, answer:AnswerData|null,
                    webhookLog:{request, response}}
SSE types  = pipeline (step: audio_normalized | sarvam_stt_done | chroma_rag_retrieved | groq_llm_synthesized |
                       sarvam_tts_ready | sms_receipt_dispatched, ms)
           | dtmf (digit) | transcript (text) | sms (text) | hello
```

Voice answers: `answerText` is <=3 spoken sentences, no URLs; the SMS receipt carries the URL, documents and helpline.

---

## 7. IVR CALL FLOW v1 (real CloudTalk call and /api/ivr-simulate behave identically)

1. `incoming` -> stage `"greeting"`: spoken menu "Hindi 1, Marathi 2, Tamil 3" (one multilingual prompt).
2. `dtmf` stage=`language`, digit 1|2|3 -> session.languageCode hi-IN|mr-IN|ta-IN; prompt category menu in that language.
3. `dtmf` stage=`category`, digit 1|2|3|4 -> session.category schemes|agri|health|education; prompt "speak after the beep".
4. `process-speech` (recording URL or audio) -> Sarvam STT (auto language) -> Agent Brain (forVoice=true) -> Sarvam TTS 8 kHz
   -> answer played to caller + SMS receipt sent (or logged as simulated) -> stage `"goodbye"`.

Invalid digit: re-prompt the same stage twice, then default to hi-IN / schemes. Silence: re-prompt once, then goodbye.

CloudTalk node payloads:

```
{"caller_number":"{{caller_number}}","dtmf_digit":"{{dtmf}}","stage":"language|category"}
{"caller_number":"..","recording_url":".."}
```

Real field names are confirmed by LD-01 and sent back as a change request.

## 8. SMS FLOW

- Input: keyword (13 scheme codes, AGRI, HEALTH, SCHOLARSHIP, HELP) or free text in hi/mr/ta/en.
- Keyword -> reply = card `sms_summary[languageCode]` (no LLM, target <300 ms). Free text -> RAG with maxChars 160.
- Reply must contain: benefit, portal, helpline. `charCount` returned; UI shows segments (Unicode SMS = 70 chars per segment).

---

## 9. RAG SERVICE (:8000) — plain JSON (no envelope), snake_case, called by Node only

```
GET  /health  -> {"status":"ok","vector_count":42,"embedding_model":"intfloat/multilingual-e5-small",
                  "mode":"llm"|"extractive"}

POST /rag/query
  req : {"query":"..","language":"hi-IN","category":"schemes"|null,"role":"farmer","for_voice":true,
         "history":[{"role":"user","content":".."},{"role":"assistant","content":".."}]}
  res : {"answer":"..",
         "sources":[{"id":"PMKISAN","title":"..","category":"schemes","helpline":"..","portal":"https://.."}],
         "matched_scheme_id":"PMKISAN"|null,
         "sms_summary":"<=160 chars, verbatim from the card in `language`"|null,
         "confidence":0.95, "mode":"llm"|"extractive", "latency_ms":812}     (mode, latency_ms: NEW, optional)
  rules: embed with the "query: " prefix, no translation. Filter by category if given. Answer in `language`.
         for_voice=true -> max 3 short sentences, plain text, no URLs/lists. Temperature 0.2.
         matched_scheme_id = top chunk is a scheme card AND similarity >= RAG_MATCH_THRESHOLD, else null.

POST /rag/ingest  req {"file_path":"/abs/or/repo-relative/path","category":"schemes"}
                  res {"ingested_chunks":12,"vector_count":54}     (res NEW)

OPTIONAL POST /rag/retrieve  same request as /rag/query, returns
                  {"chunks":[{"id","title","category","text","score"}],"matched_scheme_id"}
```

Budget: /rag/query p95 <= 1500 ms. Node waits 4000 ms, then falls back (local card match, then demo cache).

---

## 10. ENVIRONMENT (root .env, never committed; .env.example is committed; frontend uses frontend/.env.local)

```
PORT=5000   FRONTEND_ORIGIN=http://localhost:3000   (comma-separated list allowed)
AI_RAG_URL=http://localhost:8000   DB_DRIVER=postgres|sqlite|memory   DATABASE_URL=   SQLITE_PATH=data/gram_sahayak.sqlite
SARVAM_API_KEY=   LLM_API_KEY=(Groq, shared by Node and RAG)   LLM_MODEL=llama-3.3-70b-versatile
CLOUDTALK_API_KEY_ID=   CLOUDTALK_API_SECRET=   CLOUDTALK_WEBHOOK_SECRET=
TRANSLATE_PIVOT=false   USE_MOCK_AI=false   DEMO_MODE=true   APP_ENV=development|production
RAG: EMBED_MODEL=intfloat/multilingual-e5-small  CHROMA_DIR=rag/chroma_db  RAG_TOP_K=4  RAG_MATCH_THRESHOLD=0.80  MOCK_LLM=false
FRONTEND: NEXT_PUBLIC_API_URL=http://localhost:5000   NEXT_PUBLIC_USE_MOCKS=false
```

## 11. REPO AND GIT

- Monorepo: `/frontend /backend /rag /db /data/seed /data/raw /docs /scripts`. Branches: `main` (protected), `dev`, `feat/<role>-<task>`.
- Commits: `type(scope): message`, scope in `fe | be | rag | db | lead | docs`. PR into dev, Lead reviews in 5 minutes, squash-merge.
- Never commit secrets, node_modules, .venv, chroma_db, .next. Never force-push. Edit only your own folder.
- Tags: `v0-working-demo` (H16), `v1-submission` (H22).
- Time budget for one voice turn: STT <=1.2 s + RAG <=1.5 s + TTS <=1.2 s, total < 4.5 s.

---

## 12. DEMO PERSONAS (save as /data/seed/demo_personas.json; x-demo-user values; phones are fake)

```json
[
  {"id":"farmer-hi","phone":"+919829011111","name":"Ramesh Kumar",
   "role":"farmer","language":"hi-IN","occupation":"farmer",
   "land_hectares":1.2,"bpl":true,"age":45,"gender":"male",
   "pregnant":false,"annual_income":90000,"social_category":"obc"},
  {"id":"farmer-mr","phone":"+919822022222","name":"Tukaram Patil",
   "role":"farmer","language":"mr-IN","occupation":"farmer",
   "land_hectares":1.8,"bpl":false,"age":50,"gender":"male",
   "pregnant":false,"annual_income":180000,"social_category":"general"},
  {"id":"asha-ta","phone":"+919840033333","name":"Kavitha M.",
   "role":"asha","language":"ta-IN","occupation":"other",
   "land_hectares":0,"bpl":false,"age":34,"gender":"female",
   "pregnant":false,"annual_income":120000,"social_category":"general"},
  {"id":"student-hi","phone":"+919829044444","name":"Priya Verma",
   "role":"student","language":"hi-IN","occupation":"student",
   "land_hectares":0,"bpl":false,"age":16,"gender":"female",
   "pregnant":false,"annual_income":90000,"social_category":"obc"},
  {"id":"panchayat-hi","phone":"+919829055555","name":"Sunita Devi",
   "role":"panchayat","language":"hi-IN","occupation":"other",
   "land_hectares":0,"bpl":false,"age":40,"gender":"female",
   "pregnant":false,"annual_income":150000,"social_category":"general"}
]
```

asha-ta also carries the case she asks about: a 24-year-old pregnant woman (asked in the query, not stored on Kavitha's profile).

---

## CONTRACT CHANGE REQUEST (template — copy, fill, post in team chat)

```
FROM: <role>      DATE/HOUR: <H..>      CONTRACT VERSION: v1
WHAT: <endpoint or field, current text, requested text>
WHY: <what is blocked or wrong, with the real payload if you have one>
WORKAROUND UNTIL APPROVED: <closest existing field or endpoint you will use>
IMPACT: Frontend <y/n>  Backend <y/n>  RAG <y/n>  Database <y/n>
LEAD DECISION: approved / rejected / alternative      OWNER OF THE EDIT: <role>      NEW VERSION: v1.<n>
```
