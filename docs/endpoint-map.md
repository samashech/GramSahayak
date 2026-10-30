# Endpoint map (B-09) — Node gateway :5000

Generated 2026-10-30 23:37 UTC by `scripts/gen_endpoint_map.py` against `http://localhost:5000` (db=postgres, rag.ok=True). Responses are real; long strings are shortened with `…`. Source of truth for shapes: `docs/api-contract.md`.

**Every response** is the envelope `{success, data, error, timestamp}`. **Headers**: `x-session-id: <uuid>` on every browser request; optional `x-demo-user: farmer-hi | farmer-mr | asha-ta | student-hi | panchayat-hi` (persona phone becomes the session, so web + IVR + SMS share one history). Degraded service is still `success:true` with `source: "fallback"` or `"cache"`.

## Frontend tab -> endpoint

| Tab | Endpoints |
|---|---|
| 1 Voice web app (`/voice`) | `POST /api/chat`, `POST /api/voice-chat`, `GET /api/profile`, `GET /api/stream/events` |
| 2 IVR simulator (`/ivr`) | `POST /api/ivr-simulate`, `GET /api/stream/events` |
| 3 SMS simulator (`/sms`) | `POST /api/sms-simulate` |
| 4 Eligibility (`/eligibility`) | `POST /api/eligibility`, `GET /api/schemes`, `POST /api/profile` |
| `/live` projector | `GET /api/stream/events` |
| Top bar | `GET /api/health`, `POST /api/demo/reset` |
| RAG :8000 (Node only) | `POST /rag/query`, `POST /rag/ingest`, `GET /health` (contract section 9) |

## SSE: `GET /api/stream/events`

```
curl -N http://localhost:5000/api/stream/events
data: {"type":"hello","channel":"web","clients":1,"ts":"..."}
data: {"type":"transcript","channel":"web","speaker":"user","text":"पीएम किसान ...","ts":"..."}
data: {"type":"pipeline","step":"chroma_rag_retrieved","ms":48,"channel":"web","ts":"..."}
data: {"type":"pipeline","step":"groq_llm_synthesized","ms":17,"mode":"extractive","channel":"web","ts":"..."}
data: {"type":"pipeline","step":"sms_receipt_dispatched","ms":0,"channel":"web","text":"पीएम-किसान: ...","ts":"..."}
data: {"type":"dtmf","channel":"ivr","phone":"+91...","digit":"1","ts":"..."}
data: {"type":"sms","channel":"sms","phone":"+91...","direction":"out","text":"...","mode":"keyword","delivery":"simulated","ts":"..."}
: heartbeat   (every 15 s)
```

Unnamed `data:` events with a `type` field (contract section 6), so `EventSource.onmessage` receives all of them. Pipeline steps: `audio_normalized`, `sarvam_stt_done` (only with Sarvam), `chroma_rag_retrieved`, `groq_llm_synthesized` (`mode` says llm or extractive), `sarvam_tts_ready` (only with Sarvam), `sms_receipt_dispatched`.

## Endpoints (real calls)

### Health — `GET /api/health`

Used by: all (top bar status). HTTP 200, 581 ms.

```bash
curl -s -X GET http://localhost:5000/api/health -H 'x-session-id: <uuid>'
```

```json
{
  "success": true,
  "data": {
    "node": {
      "uptimeSec": 69
    },
    "db": {
      "driver": "postgres",
      "ok": true
    },
    "rag": {
      "ok": true,
      "vectorCount": 45
    },
    "sarvam": {
      "configured": false
    },
    "mockMode": false
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:22.678Z"
}
```

### Schemes — `GET /api/schemes`

Used by: Tab 1 / Tab 4. HTTP 200, 40 ms.

```bash
curl -s -X GET http://localhost:5000/api/schemes?category=health&languageCode=ta-IN -H 'x-session-id: <uuid>'
```

```json
{
  "success": true,
  "data": {
    "schemes": [
      {
        "id": "PMJAY",
        "code": "PMJAY",
        "name": "ஆயுஷ்மான் பாரத் பிரதமர் மக்கள் ஆரோக்கியத் திட்டம்",
        "category": "health",
        "targetRole": "panchayat",
        "benefits": "Free (cashless) hospital treatment up to Rs 5 lakh per family per year for secondary and …",
        "eligibility": "Poor and vulnerable families identified by SECC 2011 deprivation criteria and state-added…",
        "documents": [
          "Aadhaar card",
          "Ration card",
          "Mobile number",
          "…"
        ],
        "howToApply": "Check eligibility and create the Ayushman card at beneficiary.nha.gov.in, in the Ayushman…",
        "helpline": "14555",
        "portalUrl": "https://pmjay.gov.in",
        "smsSummary": "ஆயுஷ்மான் பாரத்: பட்டியல் மருத்துவமனைகளில் குடும்பத்துக்கு ஆண்டுக்கு ₹5 லட்சம் வரை இலவச ச…"
      },
      {
        "id": "JSY",
        "code": "JSY",
        "name": "ஜனனி சுரக்ஷா யோஜனா",
        "category": "health",
        "targetRole": "asha",
        "benefits": "Cash assistance for delivery in a government or accredited private health facility. Rural…",
        "eligibility": "In LPS states (UP, Uttarakhand, Bihar, Jharkhand, MP, Chhattisgarh, Assam, Rajasthan, Odi…",
        "documents": [
          "Mother and Child Protection (MCP) card / JSY card",
          "Aadhaar card",
          "Bank account (Aadhaar-linked)",
          "…"
        ],
        "howToApply": "Register the pregnancy with the ASHA or ANM at the sub-centre / PHC (early registration, …",
        "helpline": "104",
        "portalUrl": "https://nhm.gov.in",
        "smsSummary": "ஜனனி சுரக்ஷா: அரசு மருத்துவமனை பிரசவத்துக்கு கிராமப்புற தாய்க்கு ₹700 (HPS மாநிலம்) / ₹14…"
      },
      {
        "id": "PMMVY",
        "code": "PMMVY",
        "name": "பிரதமர் மாத்ரு வந்தனா யோஜனா",
        "category": "health",
        "targetRole": "asha",
        "benefits": "Rs 5,000 for the first child in two instalments (Rs 3,000 after pregnancy registration an…",
        "eligibility": "Pregnant women and lactating mothers aged 19 or above, from households meeting at least o…",
        "documents": [
          "Aadhaar card",
          "MCP card (with LMP date and ANC record)",
          "Aadhaar-linked bank or post office account",
          "…"
        ],
        "howToApply": "Register through the Anganwadi worker or ASHA, or online at pmmvy.wcd.gov.in (citizen log…",
        "helpline": "1515",
        "portalUrl": "https://pmmvy.wcd.gov.in",
        "smsSummary": "மாத்ரு வந்தனா: முதல் குழந்தைக்கு ₹5000 (2 தவணை), 2வது பெண் குழந்தைக்கு ₹6000. ஆவணங்கள்: ஆ…"
      }
    ]
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:22.720Z"
}
```

### Eligibility (G6) — `POST /api/eligibility`

Used by: Tab 4. HTTP 200, 48 ms. Deterministic rules only (R4). G6 = 8 eligible, 5 ineligible (CCR-02).

```bash
curl -s -X POST http://localhost:5000/api/eligibility -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"profile": {"occupation": "farmer", "land_hectares": 1.0, "bpl": true, "age": 35, "gender": "female", "pregnant": false, "annual_income": 90000, "social_category": "obc"}, "languageCode": "hi-IN"}'
```

```json
{
  "success": true,
  "data": {
    "eligibleSchemes": [
      {
        "id": "PMKISAN",
        "code": "PMKISAN",
        "name": "प्रधानमंत्री किसान सम्मान निधि",
        "category": "schemes",
        "targetRole": "farmer",
        "benefits": "Rs 6,000 per year to each eligible landholding farmer family, paid as 3 instalments of Rs…",
        "eligibility": "All landholding farmer families (husband, wife and minor children) whose names are in the…",
        "documents": [
          "Aadhaar card",
          "Land record (khatauni / 7/12 extract / patta)",
          "Aadhaar-linked bank account",
          "…"
        ],
        "howToApply": "Register on pmkisan.gov.in under 'New Farmer Registration', or at the nearest Common Serv…",
        "helpline": "155261",
        "portalUrl": "https://pmkisan.gov.in",
        "smsSummary": "पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिक…"
      },
      {
        "id": "PMFBY",
        "code": "PMFBY",
        "name": "प्रधानमंत्री फसल बीमा योजना",
        "category": "agri",
        "targetRole": "farmer",
        "benefits": "Crop insurance against loss from natural calamities, pests and diseases, from sowing to p…",
        "eligibility": "All farmers growing notified crops in notified areas, including sharecroppers and tenant …",
        "documents": [
          "Aadhaar card",
          "Land record or tenancy / sharecropping agreement",
          "Sowing certificate (from Patwari / village officer)",
          "…"
        ],
        "howToApply": "Enrol before the seasonal cut-off date through your bank (loanee farmers), a Common Servi…",
        "helpline": "14447",
        "portalUrl": "https://pmfby.gov.in",
        "smsSummary": "फसल बीमा PMFBY: किसान प्रीमियम खरीफ 2%, रबी 1.5%, व्यावसायिक फसल 5%। दस्तावेज़: आधार, भूम…"
      },
      {
        "id": "KCC",
        "code": "KCC",
        "name": "किसान क्रेडिट कार्ड",
        "category": "agri",
        "targetRole": "farmer",
        "benefits": "Short-term crop loan and working capital from banks. With interest subvention, loans up t…",
        "eligibility": "Owner-cultivator farmers, tenant farmers, oral lessees and sharecroppers, and self-help o…",
        "documents": [
          "Aadhaar card",
          "Land record or tenancy proof",
          "Passport-size photograph",
          "…"
        ],
        "howToApply": "Fill the one-page KCC form (downloadable on pmkisan.gov.in) and submit it at any commerci…",
        "helpline": "1800-180-1551",
        "portalUrl": "https://pmkisan.gov.in",
        "smsSummary": "किसान क्रेडिट कार्ड: ₹3 लाख तक फसल ऋण, समय पर चुकाने पर 4% ब्याज। दस्तावेज़: आधार, भूमि र…"
      },
      "…"
    ],
    "ineligibleSchemes": [
      {
        "scheme": {
          "id": "JSY",
          "code": "JSY",
          "name": "जननी सुरक्षा योजना",
          "category": "health",
          "targetRole": "asha",
          "benefits": "Cash assistance for delivery in a government or accredited private health facility. Rural…",
          "eligibility": "In LPS states (UP, Uttarakhand, Bihar, Jharkhand, MP, Chhattisgarh, Assam, Rajasthan, Odi…",
          "documents": [
            "Mother and Child Protection (MCP) card / JSY card",
            "Aadhaar card",
            "Bank account (Aadhaar-linked)",
            "…"
          ],
          "howToApply": "Register the pregnancy with the ASHA or ANM at the sub-centre / PHC (early registration, …",
          "helpline": "104",
          "portalUrl": "https://nhm.gov.in",
          "smsSummary": "जननी सुरक्षा योजना: सरकारी अस्पताल में प्रसव पर ग्रामीण मां को ₹1400 (LPS राज्य) या ₹700 …"
        },
        "reason": "केवल गर्भवती महिलाओं के लिए"
      },
      {
        "scheme": {
          "id": "PMMVY",
          "code": "PMMVY",
          "name": "प्रधानमंत्री मातृ वंदना योजना",
          "category": "health",
          "targetRole": "asha",
          "benefits": "Rs 5,000 for the first child in two instalments (Rs 3,000 after pregnancy registration an…",
          "eligibility": "Pregnant women and lactating mothers aged 19 or above, from households meeting at least o…",
          "documents": [
            "Aadhaar card",
            "MCP card (with LMP date and ANC record)",
            "Aadhaar-linked bank or post office account",
            "…"
          ],
          "howToApply": "Register through the Anganwadi worker or ASHA, or online at pmmvy.wcd.gov.in (citizen log…",
          "helpline": "1515",
          "portalUrl": "https://pmmvy.wcd.gov.in",
          "smsSummary": "मातृ वंदना योजना: पहले बच्चे पर ₹5000 (2 किस्त), दूसरी संतान बेटी हो तो ₹6000। दस्तावेज़:…"
        },
        "reason": "केवल गर्भवती महिलाओं के लिए"
      },
      {
        "scheme": {
          "id": "NSP",
          "code": "NSP",
          "name": "राष्ट्रीय छात्रवृत्ति पोर्टल",
          "category": "education",
          "targetRole": "student",
          "benefits": "One online window to apply for central, state and UGC/AICTE scholarships (pre-matric, pos…",
          "eligibility": "Students from Class 1 to PhD, depending on the scholarship. Most need-based scholarships …",
          "documents": [
            "Aadhaar card (or enrolment ID)",
            "Income certificate",
            "Caste certificate (if applicable)",
            "…"
          ],
          "howToApply": "Do One Time Registration (OTR) on scholarships.gov.in or the NSP OTR app with Aadhaar and…",
          "helpline": "0120-6619540",
          "portalUrl": "https://scholarships.gov.in",
          "smsSummary": "राष्ट्रीय छात्रवृत्ति पोर्टल: केंद्र व राज्य छात्रवृत्ति के लिए एक जगह आवेदन। आधार, आय/जा…"
        },
        "reason": "केवल छात्र के लिए"
      },
      "…"
    ],
    "totalMatched": 8,
    "recommendedAction": "आप 8 योजनाओं के पात्र हो सकते हैं। पहले प्रधानमंत्री किसान सम्मान निधि से शुरू करें: दस्त…"
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:22.768Z"
}
```

### Chat (G1) — `POST /api/chat`

Used by: Tab 1 text input. HTTP 200, 456 ms.

```bash
curl -s -X POST http://localhost:5000/api/chat -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"queryText": "पीएम किसान योजना के लिए कौन पात्र है?", "languageCode": "hi-IN", "category": "schemes", "role": "farmer"}'
```

```json
{
  "success": true,
  "data": {
    "answerText": "प्रधानमंत्री किसान सम्मान निधि: पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तो…",
    "languageCode": "hi-IN",
    "category": "schemes",
    "matchedSchemeId": "PMKISAN",
    "sources": [
      {
        "id": "PMKISAN",
        "title": "PM-KISAN Samman Nidhi",
        "category": "schemes",
        "helpline": "155261",
        "portalUrl": "https://pmkisan.gov.in"
      },
      {
        "id": "PMAY",
        "title": "Pradhan Mantri Awas Yojana - Gramin",
        "category": "schemes",
        "helpline": "1800-11-6446",
        "portalUrl": "https://pmayg.nic.in"
      },
      {
        "id": "UJJWALA",
        "title": "Pradhan Mantri Ujjwala Yojana (PMUY)",
        "category": "schemes",
        "helpline": "1800-233-3555",
        "portalUrl": "https://www.pmuy.gov.in"
      },
      "…"
    ],
    "smsReceipt": {
      "smsReceiptText": "पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिक…",
      "helpline": "155261",
      "portalUrl": "https://pmkisan.gov.in",
      "documents": [
        "Aadhaar card",
        "Land record (khatauni / 7/12 extract / patta)",
        "Aadhaar-linked bank account",
        "…"
      ],
      "delivery": "simulated"
    },
    "safety": {
      "flagged": false,
      "helplines": []
    },
    "source": "rag",
    "latencyMs": 61
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:23.225Z"
}
```

### Chat safety (S1) — `POST /api/chat`

Used by: Tab 1 (red safety banner). HTTP 200, 377 ms. safety.flagged=true, helplines [108]; never model text for emergencies.

```bash
curl -s -X POST http://localhost:5000/api/chat -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"queryText": "सांप ने काट लिया है, अभी क्या करें?", "languageCode": "hi-IN", "role": "farmer"}'
```

```json
{
  "success": true,
  "data": {
    "answerText": "तुरंत 108 एम्बुलेंस पर कॉल करें और मरीज को तुरंत नजदीकी सरकारी अस्पताल ले जाएं। मरीज को श…",
    "languageCode": "hi-IN",
    "category": null,
    "matchedSchemeId": null,
    "sources": [
      {
        "id": "GUIDE_HEALTH_7",
        "title": "GramSahayak Health Guide for ASHA and Anganwadi Workers (health) — Snake bite first aid",
        "category": "health",
        "helpline": "108 / 102 / 104",
        "portalUrl": "https://nhm.gov.in"
      },
      {
        "id": "GUIDE_HEALTH_1",
        "title": "GramSahayak Health Guide for ASHA and Anganwadi Workers (health) — Emergency numbers",
        "category": "health",
        "helpline": "108 / 102 / 104",
        "portalUrl": "https://nhm.gov.in"
      }
    ],
    "smsReceipt": null,
    "safety": {
      "flagged": true,
      "helplines": [
        "108"
      ]
    },
    "source": "rag",
    "latencyMs": 48
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:23.603Z"
}
```

### Voice chat — `POST /api/voice-chat`

Used by: Tab 1 mic. HTTP 200, 503 ms. Sarvam STT when SARVAM_API_KEY is set, else transcriptHint (browser SpeechRecognition). audioBase64=null -> useBrowserTts=true.

```bash
curl -s http://localhost:5000/api/voice-chat -H 'x-session-id: <uuid>' -F audio=@clip.webm -F role=asha -F category=health -F 'transcriptHint=ஜனனி சுரக்ஷா ...'
```

```json
{
  "success": true,
  "data": {
    "answerText": "ஜனனி சுரக்ஷா யோஜனா: ஜனனி சுரக்ஷா: அரசு மருத்துவமனை பிரசவத்துக்கு கிராமப்புற தாய்க்கு ₹700…",
    "languageCode": "ta-IN",
    "category": "health",
    "matchedSchemeId": "JSY",
    "sources": [
      {
        "id": "JSY",
        "title": "Janani Suraksha Yojana",
        "category": "health",
        "helpline": "104",
        "portalUrl": "https://nhm.gov.in"
      },
      {
        "id": "GUIDE_HEALTH_5",
        "title": "GramSahayak Health Guide for ASHA and Anganwadi Workers (health) — Janani Suraksha Yojana…",
        "category": "health",
        "helpline": "108 / 102 / 104",
        "portalUrl": "https://nhm.gov.in"
      },
      {
        "id": "PMJAY",
        "title": "Ayushman Bharat PM-JAY",
        "category": "health",
        "helpline": "14555",
        "portalUrl": "https://pmjay.gov.in"
      }
    ],
    "smsReceipt": {
      "smsReceiptText": "ஜனனி சுரக்ஷா: அரசு மருத்துவமனை பிரசவத்துக்கு கிராமப்புற தாய்க்கு ₹700 (HPS மாநிலம்) / ₹14…",
      "helpline": "104",
      "portalUrl": "https://nhm.gov.in",
      "documents": [
        "Mother and Child Protection (MCP) card / JSY card",
        "Aadhaar card",
        "Bank account (Aadhaar-linked)",
        "…"
      ],
      "delivery": "simulated"
    },
    "safety": {
      "flagged": false,
      "helplines": []
    },
    "source": "rag",
    "latencyMs": 90,
    "transcript": "ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?",
    "detectedLanguage": "ta-IN",
    "audioBase64": null,
    "useBrowserTts": true
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:24.107Z"
}
```

### Profile (read) — `GET /api/profile`

Used by: Tab 1 history list. HTTP 200, 413 ms. profile is null for a brand-new visitor.

```bash
curl -s -X GET http://localhost:5000/api/profile -H 'x-session-id: <uuid>' -H 'x-demo-user: asha-ta'
```

```json
{
  "success": true,
  "data": {
    "profile": {
      "session_key": "+919840033333",
      "phone": "+919840033333",
      "role": "asha",
      "language": "ta-IN",
      "occupation": "other",
      "land_hectares": 0,
      "bpl": false,
      "age": 34,
      "gender": "female",
      "pregnant": false,
      "annual_income": 120000,
      "social_category": "general",
      "state": null,
      "district": null,
      "updated_at": "2026-10-30T23:36:15.024Z"
    },
    "history": [
      {
        "ts": "2026-10-31T00:00:00.000Z",
        "text": "24 வயது கர்ப்பிணிப் பெண்ணுக்கு ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?",
        "channel": "web",
        "speaker": "user",
        "category": "health",
        "language": "ta-IN"
      },
      {
        "ts": "2026-10-31T00:00:02.000Z",
        "text": "ஜனனி சுரக்ஷா யோஜனா (JSY) திட்டத்தில் அரசு மருத்துவமனை பிரசவத்துக்கு கிராமப்புற தாய்க்கு ₹…",
        "channel": "web",
        "speaker": "assistant",
        "category": "health",
        "language": "ta-IN"
      }
    ]
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:24.520Z"
}
```

### Profile (update) — `POST /api/profile`

Used by: Tab 4 form. HTTP 200, 198 ms.

```bash
curl -s -X POST http://localhost:5000/api/profile -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"land_hectares": 1.5, "bpl": true}'
```

```json
{
  "success": true,
  "data": {
    "profile": {
      "land_hectares": 1.5,
      "bpl": true,
      "session_key": "endpoint-map-99ccb93b",
      "phone": null,
      "updated_at": "2026-10-30T23:37:24.653Z"
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:24.720Z"
}
```

### IVR simulator: send stage=greeting — `POST /api/ivr-simulate`

Used by: Tab 2. HTTP 200, 107 ms. Response stage = where the call now is: greeting -> send 'language' next.

```bash
curl -s -X POST http://localhost:5000/api/ivr-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"callerPhone": "+919999912345", "stage": "greeting"}'
```

```json
{
  "success": true,
  "data": {
    "stage": "greeting",
    "promptText": "ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा. தமிழுக்கு 3 அழுத்…",
    "audioBase64": null,
    "useBrowserTts": true,
    "session": {
      "languageCode": "hi-IN",
      "category": null
    },
    "answer": null,
    "webhookLog": {
      "request": {
        "caller_number": "+919999912345"
      },
      "response": {
        "stage": "greeting",
        "promptText": "ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा. தமிழுக்கு 3 அழுத்…",
        "audioBase64": null,
        "useBrowserTts": true,
        "session": {
          "languageCode": "hi-IN",
          "category": null
        },
        "answer": null
      }
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:24.828Z"
}
```

### IVR simulator: send stage=language — `POST /api/ivr-simulate`

Used by: Tab 2. HTTP 200, 307 ms. response stage 'language' -> send 'category' next.

```bash
curl -s -X POST http://localhost:5000/api/ivr-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"callerPhone": "+919999912345", "stage": "language", "dtmfDigit": "1"}'
```

```json
{
  "success": true,
  "data": {
    "stage": "language",
    "promptText": "सरकारी योजना के लिए 1, खेती के लिए 2, स्वास्थ्य के लिए 3, छात्रवृत्ति के लिए 4 दबाएं।",
    "audioBase64": null,
    "useBrowserTts": true,
    "session": {
      "languageCode": "hi-IN",
      "category": null
    },
    "answer": null,
    "webhookLog": {
      "request": {
        "caller_number": "+919999912345",
        "dtmf_digit": "1",
        "stage": "language"
      },
      "response": {
        "stage": "language",
        "promptText": "सरकारी योजना के लिए 1, खेती के लिए 2, स्वास्थ्य के लिए 3, छात्रवृत्ति के लिए 4 दबाएं।",
        "audioBase64": null,
        "useBrowserTts": true,
        "session": {
          "languageCode": "hi-IN",
          "category": null
        },
        "answer": null
      }
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:25.135Z"
}
```

### IVR simulator: send stage=category — `POST /api/ivr-simulate`

Used by: Tab 2. HTTP 200, 101 ms. response stage 'category' -> send 'speech' (text or multipart audio) next.

```bash
curl -s -X POST http://localhost:5000/api/ivr-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"callerPhone": "+919999912345", "stage": "category", "dtmfDigit": "1"}'
```

```json
{
  "success": true,
  "data": {
    "stage": "category",
    "promptText": "बीप के बाद अपना सवाल बोलें।",
    "audioBase64": null,
    "useBrowserTts": true,
    "session": {
      "languageCode": "hi-IN",
      "category": "schemes"
    },
    "answer": null,
    "webhookLog": {
      "request": {
        "caller_number": "+919999912345",
        "dtmf_digit": "1",
        "stage": "category"
      },
      "response": {
        "stage": "category",
        "promptText": "बीप के बाद अपना सवाल बोलें।",
        "audioBase64": null,
        "useBrowserTts": true,
        "session": {
          "languageCode": "hi-IN",
          "category": "schemes"
        },
        "answer": null
      }
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:25.238Z"
}
```

### IVR simulator: send stage=speech — `POST /api/ivr-simulate`

Used by: Tab 2. HTTP 200, 409 ms. response stage 'answer' with AnswerData + SMS receipt (delivery: simulated) -> send 'goodbye'.

```bash
curl -s -X POST http://localhost:5000/api/ivr-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"callerPhone": "+919999912345", "stage": "speech", "text": "पीएम किसान योजना के लिए कौन पात्र है?"}'
```

```json
{
  "success": true,
  "data": {
    "stage": "answer",
    "promptText": "प्रधानमंत्री किसान सम्मान निधि: पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तो…",
    "audioBase64": null,
    "useBrowserTts": true,
    "session": {
      "languageCode": "hi-IN",
      "category": "schemes"
    },
    "answer": {
      "answerText": "प्रधानमंत्री किसान सम्मान निधि: पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तो…",
      "languageCode": "hi-IN",
      "category": "schemes",
      "matchedSchemeId": "PMKISAN",
      "sources": [
        {
          "id": "PMKISAN",
          "title": "PM-KISAN Samman Nidhi",
          "category": "schemes",
          "helpline": "155261",
          "portalUrl": "https://pmkisan.gov.in"
        },
        {
          "id": "PMAY",
          "title": "Pradhan Mantri Awas Yojana - Gramin",
          "category": "schemes",
          "helpline": "1800-11-6446",
          "portalUrl": "https://pmayg.nic.in"
        },
        {
          "id": "UJJWALA",
          "title": "Pradhan Mantri Ujjwala Yojana (PMUY)",
          "category": "schemes",
          "helpline": "1800-233-3555",
          "portalUrl": "https://www.pmuy.gov.in"
        }
      ],
      "smsReceipt": {
        "smsReceiptText": "पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिक…",
        "helpline": "155261",
        "portalUrl": "https://pmkisan.gov.in",
        "documents": [
          "Aadhaar card",
          "Land record (khatauni / 7/12 extract / patta)",
          "Aadhaar-linked bank account",
          "…"
        ],
        "delivery": "simulated"
      },
      "safety": {
        "flagged": false,
        "helplines": []
      },
      "source": "rag",
      "latencyMs": 56
    },
    "webhookLog": {
      "request": {
        "caller_number": "+919999912345",
        "recording_url": null,
        "text": "पीएम किसान योजना के लिए कौन पात्र है?"
      },
      "response": {
        "stage": "answer",
        "promptText": "प्रधानमंत्री किसान सम्मान निधि: पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तो…",
        "audioBase64": null,
        "useBrowserTts": true,
        "session": {
          "languageCode": "hi-IN",
          "category": "schemes"
        },
        "answer": {
          "answerText": "प्रधानमंत्री किसान सम्मान निधि: पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तो…",
          "languageCode": "hi-IN",
          "category": "schemes",
          "matchedSchemeId": "PMKISAN",
          "sources": [
            {
              "id": "PMKISAN",
              "title": "PM-KISAN Samman Nidhi",
              "category": "schemes",
              "helpline": "155261",
              "portalUrl": "https://pmkisan.gov.in"
            },
            {
              "id": "PMAY",
              "title": "Pradhan Mantri Awas Yojana - Gramin",
              "category": "schemes",
              "helpline": "1800-11-6446",
              "portalUrl": "https://pmayg.nic.in"
            },
            {
              "id": "UJJWALA",
              "title": "Pradhan Mantri Ujjwala Yojana (PMUY)",
              "category": "schemes",
              "helpline": "1800-233-3555",
              "portalUrl": "https://www.pmuy.gov.in"
            }
          ],
          "smsReceipt": {
            "smsReceiptText": "पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिक…",
            "helpline": "155261",
            "portalUrl": "https://pmkisan.gov.in",
            "documents": [
              "Aadhaar card",
              "Land record (khatauni / 7/12 extract / patta)",
              "Aadhaar-linked bank account",
              "…"
            ],
            "delivery": "simulated"
          },
          "safety": {
            "flagged": false,
            "helplines": []
          },
          "source": "rag",
          "latencyMs": 56
        }
      }
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:25.648Z"
}
```

### IVR simulator: send stage=goodbye — `POST /api/ivr-simulate`

Used by: Tab 2. HTTP 200, 54 ms. Call ends; state cleared.

```bash
curl -s -X POST http://localhost:5000/api/ivr-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"callerPhone": "+919999912345", "stage": "goodbye"}'
```

```json
{
  "success": true,
  "data": {
    "stage": "goodbye",
    "promptText": "धन्यवाद। जानकारी SMS से भेजी गई है। नमस्ते।",
    "audioBase64": null,
    "useBrowserTts": true,
    "session": {
      "languageCode": "hi-IN",
      "category": "schemes"
    },
    "answer": null,
    "webhookLog": {
      "request": {
        "caller_number": "+919999912345",
        "event": "hangup"
      },
      "response": {
        "stage": "goodbye",
        "promptText": "धन्यवाद। जानकारी SMS से भेजी गई है। नमस्ते।",
        "audioBase64": null,
        "useBrowserTts": true,
        "session": {
          "languageCode": "hi-IN",
          "category": "schemes"
        },
        "answer": null
      }
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:25.703Z"
}
```

### SMS simulator (G8 keyword) — `POST /api/sms-simulate`

Used by: Tab 3. HTTP 200, 302 ms. Keyword path, no LLM, <300 ms. Reply = seed card sms_summary verbatim (R5).

```bash
curl -s -X POST http://localhost:5000/api/sms-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"fromPhone": "+919999912345", "body": "PMKISAN"}'
```

```json
{
  "success": true,
  "data": {
    "replyText": "पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिक…",
    "charCount": 144,
    "matchedSchemeId": "PMKISAN",
    "mode": "keyword",
    "delivery": "simulated"
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:26.005Z"
}
```

### SMS simulator (free text) — `POST /api/sms-simulate`

Used by: Tab 3. HTTP 200, 510 ms.

```bash
curl -s -X POST http://localhost:5000/api/sms-simulate -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"fromPhone": "+919999912345", "body": "गेहूं में पीला रतुआ रोग लगा है, क्या करें?"}'
```

```json
{
  "success": true,
  "data": {
    "replyText": "गेहूं में पीला रतुआ रोग से बचाव के लिए रोग-रोधी किस्में बोएं, अधिक यूरिया न डालें और दिसं…",
    "charCount": 160,
    "matchedSchemeId": null,
    "mode": "rag",
    "delivery": "simulated"
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:26.516Z"
}
```

### Demo reset — `POST /api/demo/reset`

Used by: top bar 'Reset demo'. HTTP 200, 2100 ms. DEMO_MODE only. Restores the 5 personas incl. starter_history.

```bash
curl -s -X POST http://localhost:5000/api/demo/reset -H 'x-session-id: <uuid>'
```

```json
{
  "success": true,
  "data": {
    "reset": true,
    "users": [
      {
        "id": "farmer-hi",
        "name": "Ramesh Kumar",
        "phone": "+919829011111",
        "role": "farmer",
        "language": "hi-IN"
      },
      {
        "id": "farmer-mr",
        "name": "Tukaram Patil",
        "phone": "+919822022222",
        "role": "farmer",
        "language": "mr-IN"
      },
      {
        "id": "asha-ta",
        "name": "Kavitha M.",
        "phone": "+919840033333",
        "role": "asha",
        "language": "ta-IN"
      },
      "…"
    ]
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:28.616Z"
}
```

### CloudTalk webhook: incoming call — `POST /api/cloudtalk/voice/incoming`

Used by: CloudTalk only. HTTP 200, 113 ms.

```bash
curl -s -X POST http://localhost:5000/api/cloudtalk/voice/incoming -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"caller_number": "+919999912345"}'
```

```json
{
  "success": true,
  "data": {
    "stage": "greeting",
    "promptText": "ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा. தமிழுக்கு 3 அழுத்…",
    "audioBase64": null,
    "useBrowserTts": true,
    "session": {
      "languageCode": "hi-IN",
      "category": null
    },
    "answer": null,
    "webhookLog": {
      "request": {
        "caller_number": "+919999912345"
      },
      "response": {
        "stage": "greeting",
        "promptText": "ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा. தமிழுக்கு 3 அழுத்…",
        "audioBase64": null,
        "useBrowserTts": true,
        "session": {
          "languageCode": "hi-IN",
          "category": null
        },
        "answer": null
      }
    }
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:28.730Z"
}
```

### CloudTalk webhook: inbound SMS — `POST /api/cloudtalk/sms/incoming`

Used by: CloudTalk only. HTTP 200, 345 ms.

```bash
curl -s -X POST http://localhost:5000/api/cloudtalk/sms/incoming -H 'x-session-id: <uuid>' -H 'Content-Type: application/json' -d '{"from": "+919999912345", "body": "HELP"}'
```

```json
{
  "success": true,
  "data": {
    "replyText": "ग्राम सहायक: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRA…",
    "charCount": 141,
    "matchedSchemeId": null,
    "mode": "help",
    "delivery": "simulated"
  },
  "error": null,
  "timestamp": "2026-10-30T23:37:29.077Z"
}
```

Also: `GET /api/docs` (Swagger UI + table), `GET /api/docs/openapi.json`, `POST /api/schemes/ingest`, `POST /api/cloudtalk/voice/dtmf-category`, `POST /api/cloudtalk/voice/process-speech` (same IvrStep as the simulator).
