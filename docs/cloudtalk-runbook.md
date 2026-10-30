# GramSahayak — CloudTalk Trial, Call Flow & Webhook Runbook (`LD-01`)

> **Owner:** Team Lead (`lead`) · **Target Service:** Node Gateway (`:5000`)
> **Contract Reference:** [`/docs/api-contract.md`](api-contract.md) Sections 7 & 8 (IVR Call Flow v1 & SMS Flow)
> **Timebox & Cut Gate:** **Hour 6 (`H6`)** — see Decision Rule `DR-03` in [`/docs/decisions.md`](decisions.md)

---

## 1. Step-by-Step Setup Runbook

> **Important Honesty & Verification Note:** Steps where the exact CloudTalk dashboard button or label may vary by account version are marked **`[VERIFY IN DASHBOARD]`**. Do not guess field names; capture the 5 verification screenshots listed in Section 2 and submit any field name differences as a **Contract Change Request (`CCR-03`)**.

### Step 1: Start the Local Backend & Cloudflare HTTPS Tunnel
CloudTalk webhooks require a publicly reachable `HTTPS` URL pointing to the Node Gateway on `:5000`.
```bash
# Terminal 1 — Run the Node.js Gateway on :5000
cd backend
npm start

# Terminal 2 — Expose localhost:5000 over HTTPS via Cloudflare Quick Tunnel
npx cloudflared tunnel --url http://localhost:5000
```
- Copy the generated `https://<random-words>.trycloudflare.com` URL (henceforth `<TUNNEL_URL>`).
- **Smoke check the tunnel:**
  ```bash
  curl -s <TUNNEL_URL>/api/health
  ```
  Must return `{"success":true,"data":{"node":...}}`.
- *Warning:* Restarting `npx cloudflared tunnel` generates a **new URL** — keep Terminal 2 running continuously and update the CloudTalk webhook nodes if restarted (`E-GS-08`).

### Step 2: Provision CloudTalk 14-Day Trial & Phone Number
1. Sign up / log in at the CloudTalk Dashboard (`https://my.cloudtalk.io`) **`[VERIFY IN DASHBOARD]`**.
2. Navigate to **Numbers -> Get a Number / Buy Number** **`[VERIFY IN DASHBOARD: exact menu label]`**.
3. Request an **Indian (`+91`)** toll-free (`1800`) or local inbound number if available on the trial; if `+91` requires KYC/regulatory approval that takes >2 hours, request the default trial inbound number provided by CloudTalk so live DTMF + voice webhooks can still be demonstrated from a whitelisted handset.
4. Generate REST API credentials under **Account -> Settings -> API Keys** **`[VERIFY IN DASHBOARD]`** and add them to root `.env` (never commit `.env`):
   ```ini
   CLOUDTALK_API_KEY_ID=<your-key-id>
   CLOUDTALK_API_SECRET=<your-key-secret>
   CLOUDTALK_WEBHOOK_SECRET=<your-webhook-secret>
   ```

### Step 3: Build the Two-Stage Call Flow in CloudTalk Call Flow Designer
Open **Numbers -> [Edit Number] -> Call Flow Designer** **`[VERIFY IN DASHBOARD]`** and wire the 5-step sequence matching Contract Section 7:

1. **Node 1 — Incoming Call Greeting (`stage = "greeting"`):**
   - Add an **HTTP Request / Webhook** node (or **Play Audio + IVR Menu** node **`[VERIFY IN DASHBOARD: whether HTTP node can return TTS audio directly or plays a static prompt]`**).
   - **Endpoint:** `POST <TUNNEL_URL>/api/cloudtalk/voice/incoming`
   - **Spoken Multilingual Prompt:** *"नमस्ते, ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा। தமிழுக்கு 3 அழுத்தவும்।"* ("Hindi 1, Marathi 2, Tamil 3").
2. **Node 2 — Stage 1 DTMF Menu: Language Selection (`stage = "language"`):**
   - Collect 1 DTMF digit (`1` = `hi-IN`, `2` = `mr-IN`, `3` = `ta-IN`).
   - Route to **HTTP Request / Webhook** node:
     - **Endpoint:** `POST <TUNNEL_URL>/api/cloudtalk/voice/dtmf-category`
     - **JSON Body:** `{"caller_number": "{{caller_number}}", "dtmf_digit": "{{dtmf}}", "stage": "language"}` **`[VERIFY IN DASHBOARD: exact variable syntax for caller number and DTMF digit]`**
   - Plays localized category menu in the selected language (`1` Schemes, `2` Farming/Agri, `3` Health, `4` Education/Scholarships).
   - *Invalid digit handling:* Re-prompt the same stage up to twice; on 3rd invalid/timeout, default to `hi-IN`.
3. **Node 3 — Stage 2 DTMF Menu: Category Selection (`stage = "category"`):**
   - Collect 1 DTMF digit (`1` = `schemes`, `2` = `agri`, `3` = `health`, `4` = `education`).
   - Route to **HTTP Request / Webhook** node:
     - **Endpoint:** `POST <TUNNEL_URL>/api/cloudtalk/voice/dtmf-category`
     - **JSON Body:** `{"caller_number": "{{caller_number}}", "dtmf_digit": "{{dtmf}}", "stage": "category"}` **`[VERIFY IN DASHBOARD]`**
   - Plays localized prompt: *"बीप के बाद अपना सवाल बोलें"* ("Speak your question after the beep").
   - *Invalid digit handling:* Re-prompt up to twice, then default to `schemes`.
4. **Node 4 — Voice Recording & Speech Processing (`stage = "speech" -> "answer"`):**
   - Add a **Record Audio / Voicemail** node (max 15–20 seconds, stop on `#` or 2 seconds of silence) **`[VERIFY IN DASHBOARD: whether recording node exposes recording_url to a subsequent HTTP node in the same call or fires an post-recording webhook]`**.
   - Route to **HTTP Request / Webhook** node:
     - **Endpoint:** `POST <TUNNEL_URL>/api/cloudtalk/voice/process-speech`
     - **JSON Body:** `{"caller_number": "{{caller_number}}", "recording_url": "{{recording_url}}"}` **`[VERIFY IN DASHBOARD]`**
   - Node Gateway downloads `recording_url` -> `ffmpeg` 16 kHz mono WAV -> Sarvam `saarika:v2.5` STT -> `agentBrain` (`/rag/query` with `for_voice=true`) -> Sarvam `bulbul:v2` 8 kHz telephony TTS -> dispatches SMS receipt (`sms_summary` `<=160` chars) -> returns spoken response.
5. **Node 5 — Play Spoken Answer & Hang Up (`stage = "goodbye"`):**
   - Play the returned TTS audio / prompt text and end the call cleanly.

---

## 2. Webhook Payload Field Mapping Table & 5 Required Captures

### Webhook Payload Mapping (Contract §7 vs Real CloudTalk)

| Step / Node | Backend Route (`:5000`) | JSON We Configure CloudTalk to Send | Real CloudTalk Field Names | Backend Response Shape (`Envelope<IvrStep>`) |
| :--- | :--- | :--- | :---: | :--- |
| **1. Call Incoming** | `POST /api/cloudtalk/voice/incoming` | `{"caller_number": "{{caller_number}}"}` | `TBC` *(Capture #1)* | `{"success": true, "data": {"stage": "greeting", "promptText": "...", "audioBase64": "...", "session": {"languageCode": "hi-IN", "category": null}}}` |
| **2. DTMF Language** | `POST /api/cloudtalk/voice/dtmf-category` | `{"caller_number": "{{caller_number}}", "dtmf_digit": "3", "stage": "language"}` | `TBC` *(Capture #2)* | `{"success": true, "data": {"stage": "language", "promptText": "...", "audioBase64": "...", "session": {"languageCode": "ta-IN", "category": null}}}` |
| **3. DTMF Category** | `POST /api/cloudtalk/voice/dtmf-category` | `{"caller_number": "{{caller_number}}", "dtmf_digit": "3", "stage": "category"}` | `TBC` *(Capture #3)* | `{"success": true, "data": {"stage": "category", "promptText": "...", "audioBase64": "...", "session": {"languageCode": "ta-IN", "category": "health"}}}` |
| **4. Process Speech** | `POST /api/cloudtalk/voice/process-speech` | `{"caller_number": "{{caller_number}}", "recording_url": "https://..."}` | `TBC` *(Capture #4)* | `{"success": true, "data": {"stage": "answer", "promptText": "...", "audioBase64": "...", "answer": {"answerText": "...", "matchedSchemeId": "JSY", "smsReceipt": {...}, "safety": {...}}}}` |
| **5. Incoming SMS** | `POST /api/cloudtalk/sms/incoming` | `{"from": "+919829011111", "body": "PMKISAN", "languageCode": "hi-IN"}` | `TBC` *(Capture #5)* | `{"success": true, "data": {"replyText": "...", "charCount": 142, "matchedSchemeId": "PMKISAN", "mode": "keyword", "delivery": "sent\|simulated"}}` |

### The 5 Captures Required to Replace `"TBC"` (Submit as `CCR-03`)
When testing the CloudTalk dashboard with `<TUNNEL_URL>`, capture screenshots / Node request logs for:
1. **Capture #1 (Caller ID field):** Exact JSON key CloudTalk sends for the caller's E.164 phone number (e.g., `caller_number` vs `from` vs `contact_phone`).
2. **Capture #2 (DTMF variable name):** Exact template variable or JSON key for the pressed keypad digit in the Call Flow HTTP node (e.g., `dtmf_digit` vs `input` vs `digits`).
3. **Capture #3 (Recording URL payload):** Exact JSON key and URL auth behaviour when a voice recording finishes (`recording_url` vs `audio_url`, and whether Basic Auth headers are required to download the `.wav`/`.mp3`).
4. **Capture #4 (In-call audio playback expectation):** Whether the CloudTalk Call Flow HTTP node expects a JSON response containing an audio URL, TwiML-like XML, or only triggers side-effects while CloudTalk plays pre-uploaded prompts.
5. **Capture #5 (Inbound/Outbound SMS payload):** Exact JSON keys for inbound SMS webhook (`from`/`sender`, `body`/`message`/`text`) and whether outbound SMS to `+91` numbers succeeds or is blocked by Indian TRAI DLT filtering.

---

## 3. Risks & The Hour-6 (`H6`) Decision Rule

1. **Risk A — Indian (`+91`) Number & TRAI DLT SMS Regulations:**
   - Provisioning a `+91` toll-free (`1800`) or local number on a trial account often requires business KYC verification, and commercial outbound SMS in India requires TRAI DLT template registration (especially for Unicode regional scripts `hi-IN`, `mr-IN`, `ta-IN`).
2. **Risk B — Call Flow Synchronous Audio Playback:**
   - Many cloud PBX webhook nodes execute asynchronously or cannot play dynamically returned base64 WAV audio mid-call without a public audio file URL.
3. **Hard Decision Rule at Hour 6 (`DR-03` in `docs/decisions.md`):**
   - **If there is no working inbound phone number by `H6` (or if webhook troubleshooting exceeds 20 minutes per `E-GS-08`):**
     1. **Drop the live phone call immediately.**
     2. Keep **Tab 2 (On-Screen Toll-Free IVR Phone Simulator)** and **Tab 3 (Offline SMS Simulator)** as the **primary demo path** — they invoke the exact same Backend controller functions (`POST /api/ivr-simulate`, `POST /api/sms-simulate`), stream real-time SSE events to `/live`, and display the `"what CloudTalk would send"` `webhookLog` drawer for judges.
     3. Record **one 60-second real-style call backup video** (`1080p`) showing a handset dialing while `/live` animates.

---

## 4. Live Demo Rehearsal Card

| Role / Item | Assigned Value / Action |
| :--- | :--- |
| **Caller Handset (Who Calls)** | **Team Lead (Sameer)** using whitelisted handset (`+91-98290-11111` demo preset `farmer-hi` or `asha-ta` `+91-98400-33333`) on speakerphone held near the podium mic. |
| **SMS Recipient Handset** | Secondary basic/Android phone set to high brightness showing the incoming SMS receipt (`<=160` chars with portal URL + helpline) OR Tab 2 top slide-in `"SMS received"` notification + Tab 3 thread. |
| **Projector Screen (`/live`)** | Second browser window full-screen on `http://localhost:3000/live` (`GramSahayak LIVE`). |
| **Expected Visual Sequence (< 5 s)** | 1. Caller masked as `+91 98290 XXXXX` appears on `/live`<br>2. Big DTMF digits animate: `3` (`ta-IN`) -> `3` (`health`) *(or `1` `hi-IN` -> `1` `schemes`)*<br>3. 6 pipeline bars light up with millisecond timings (`audio_normalized` -> `sarvam_stt_done` -> `chroma_rag_retrieved` -> `groq_llm_synthesized` -> `sarvam_tts_ready` -> `sms_receipt_dispatched`)<br>4. Live regional transcript + spoken 3-sentence answer + verbatim SMS receipt card appear on `/live`. |
| **Instant Fallback If Signal Drops** | Presenter clicks **Tab 2 (`/ivr`)** on the laptop -> presses green Call button -> taps `1` (`hi-IN`) -> `1` (`schemes`) -> clicks `G1` mic/text -> `/live` animates identically. |
