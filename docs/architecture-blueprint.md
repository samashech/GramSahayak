# GramSahayak (ग्राम सहायक) — Architecture Blueprint

Companion to `/docs/api-contract.md` (Contract v1). Where they differ, the contract wins.

## 1. System diagram

```mermaid
flowchart LR
  subgraph Channels
    WEB["Voice-first web app<br/>Next.js :3000<br/>Tabs: Voice · Call sim · SMS sim · Eligibility · /live"]
    IVR["Toll-free call<br/>CloudTalk Call Flow<br/>IVR + DTMF (language 1-3, category 1-4)"]
    SMS["Offline SMS<br/>CloudTalk SMS webhook<br/>feature phones"]
  end

  subgraph Node["Node.js gateway :5000 (backend)"]
    API["Express routes<br/>/api/* envelope"]
    CTX["sessionContext<br/>x-session-id · x-demo-user · phone"]
    BRAIN["agentBrain.answerQuery<br/>safety routing · RAG call · fallback"]
    ELIG["eligibilityEngine.checkEligibility<br/>deterministic rules (R4)"]
    SMSP["smsParserService.handleSmsQuery<br/>keyword -> card sms_summary (R5)"]
    SARVAM["sarvamService<br/>saarika:v2.5 STT · bulbul:v2 TTS · mayura:v1"]
    FF["ffmpeg -> 16 kHz mono WAV"]
    CACHE["demoCache (golden 8)"]
    SSE["SSE /api/stream/events"]
    DBA["dbAdapter<br/>postgres | sqlite | memory+json"]
  end

  subgraph RAG["Python RAG :8000 (stateless)"]
    RQ["POST /rag/query"]
    CH[("Chroma<br/>multilingual-e5-small")]
    GROQ["Groq llama-3.3-70b-versatile<br/>(extractive fallback)"]
  end

  SEED[("/data/seed<br/>schemes.json · agri.md · health.md · education.md · demo_personas.json")]
  DB[("Supabase Postgres / SQLite / memory")]
  SARVAMAPI["Sarvam AI API"]
  CTAPI["CloudTalk REST API (SMS send)"]

  WEB -- "HTTPS JSON / multipart / SSE (R1)" --> API
  IVR -- "webhooks /api/cloudtalk/voice/*" --> API
  SMS -- "webhook /api/cloudtalk/sms/incoming" --> API
  API --> CTX --> BRAIN
  API --> ELIG
  API --> SMSP
  SMSP -- "free text" --> BRAIN
  BRAIN -- "regional text, no pivot (R6), 4000 ms timeout" --> RQ
  RQ --> CH
  RQ --> GROQ
  BRAIN -- "on timeout/error" --> CACHE
  API --> FF --> SARVAM --> SARVAMAPI
  BRAIN -- "call-to-SMS receipt" --> CTAPI
  BRAIN --> SSE --> WEB
  CTX --> DBA --> DB
  SEED --> ELIG
  SEED --> SMSP
  SEED --> DBA
  SEED -- "ingest.py" --> CH
```

Every channel ends in the Node gateway. Only the gateway talks to Sarvam, CloudTalk, the database and the RAG service (R1, R3). The RAG service answers one question at a time and keeps no state (R2). The scheme cards in `/data/seed` feed the RAG index, the deterministic eligibility engine and the database, so all three agree (R7).

## 2. One voice turn (target < 4.5 s)

```mermaid
sequenceDiagram
  participant U as Caller / browser
  participant N as Node :5000
  participant S as Sarvam
  participant R as RAG :8000
  participant C as CloudTalk
  U->>N: audio (webm / recording_url)
  N->>N: ffmpeg -> 16 kHz WAV  [SSE audio_normalized]
  N->>S: saarika:v2.5 STT (auto language)  <=1.2 s
  S-->>N: transcript + language  [SSE sarvam_stt_done]
  N->>N: safety keywords (108 / 102 / 1800-180-1551)
  N->>R: /rag/query {query, language, category, role, for_voice:true, history[6]}  <=1.5 s
  R-->>N: answer, sources, matched_scheme_id  [SSE chroma_rag_retrieved, groq_llm_synthesized]
  N->>N: smsReceipt = card.sms_summary[languageCode] (R5)
  N->>S: bulbul:v2 TTS (8 kHz IVR / 22.05 kHz web)  <=1.2 s  [SSE sarvam_tts_ready]
  N->>C: send SMS receipt (or log "simulated")  [SSE sms_receipt_dispatched]
  N-->>U: AnswerData / IvrStep
```

## 3. Degradation ladder (the demo never fails)

| Failure | Node behaviour | `source` |
|---|---|---|
| RAG down / > 4000 ms | local card match by code / name keywords | `fallback` |
| No card match | golden demo cache | `cache` |
| `USE_MOCK_AI=true` | demo cache first, then local card match | `cache` / `fallback` |
| Sarvam STT fails | use `transcriptHint` from browser SpeechRecognition, else `ERR_STT_FAILED` | — |
| Sarvam TTS fails | `audioBase64:null`, `useBrowserTts:true` | — |
| DB unreachable | dbAdapter falls back to memory + `/data/seed` | — |
| CloudTalk SMS fails / DLT | receipt `delivery:"simulated"` or `"failed"` | — |

## 4. Backend module map (`/backend/src`)

| Folder | Files | Prompt |
|---|---|---|
| `config/` | `index.js` (env, languages, categories, roles) | B-01 |
| `utils/` | `response.js` (envelope), `logger` | B-01 |
| `middlewares/` | `errorHandler.js`, `upload.js`, `sessionContext.js`, `offlineFallback.js` | B-01, B-04, B-10 |
| `adapters/` | `dbAdapter.js` + drivers `memoryDriver`, `sqliteDriver`, `postgresDriver` | B-02 |
| `services/` | `sessionService`, `seedService`, `eligibilityEngine`, `smsParserService`, `agentBrain`, `sarvamService`, `cloudtalkService`, `eventBus` | B-02 … B-08 |
| `controllers/` | `cloudtalkController.js`, others | B-07 |
| `routes/` | `health`, `schemes`, `profile`, `chat`, `demo`, `cloudtalk`, `simulate`, `stream` | B-01 … B-08 |

## 5. Contract change requests found while writing this blueprint

None blocking. Notes for the Lead are listed in the A-00 / K-01 hand-off message.
