# Sarvam voice agent (real phone calls), DEC-19

Sarvam Voice Agents (Samvaad) runs the phone call: the number, listening, speaking and turn-taking in
Indian languages. Every factual question goes to our gateway through one HTTPS tool, so a caller hears the
same verified, safety-screened answer as the web app and the IVR simulator, and gets the same SMS receipt.

```
Caller ── phone ──► Sarvam voice agent ── HTTPS tool ──► POST /api/agent/answer (Node gateway)
                     (speech in/out)                      safety screen → RAG → seed card → SMS receipt
```

## 1. Create the agent (Sarvam dashboard → Voice Agents)

- **Name:** GramSahayak
- **Languages:** Hindi, Marathi, Gujarati, English (add Tamil if offered).
- **Voice:** a female Indian voice (the TTS model is chosen in the dashboard; Sarvam retires `bulbul:v3`
  on Voice Agents on 10 Nov 2026, so pick a `bulbul:v4` voice).
- **Welcome message:** "नमस्ते, ग्राम सहायक में आपका स्वागत है। सरकारी योजना, खेती, स्वास्थ्य या छात्रवृत्ति के बारे में पूछिए।"

**Instructions** (paste as is):

```
You are GramSahayak, a patient helper for rural callers in India: farmers, ASHA workers, Panchayat
operators and students. Speak the caller's language (Hindi, Marathi, Gujarati or English); switch if they do.
Use short, simple sentences a villager understands. Never use English jargon when a local word exists.

For ANY question about government schemes, money amounts, eligibility, documents, farming, crops, pests,
health, pregnancy, or scholarships: call tool:get_verified_answer with the caller's question in their own
words and language. Then say the tool's answer. Do not add facts, amounts, phone numbers or websites that
are not in the tool's answer. If the tool fails, say you could not check right now and give the Kisan Call
Centre 1800-180-1551 or health helpline 104.

If the caller describes an emergency (snake bite, bleeding, unconscious, poisoning, labour pain), tell them
to call 108 immediately, before anything else.

After each answer ask if they have another question. End the call politely when they say no.
Never decide whether someone is eligible yourself; only repeat what the tool says.
```

## 2. Add the tool (Build → Tools → API tool)

| Field | Value |
|---|---|
| Name | `get_verified_answer` |
| Description | Verified answer from GramSahayak's scheme cards and guides for any question on schemes, farming, health or scholarships. |
| When | During conversation |
| Method / URL | `POST https://<backend-host>/api/agent/answer` |
| Auth | Bearer token = `AGENT_TOOL_TOKEN` from the root `.env` (written by `deploy/azure.sh`) |
| Body (JSON) | `{"question": "<the caller's question>", "language": "<current language>", "caller": "@User Identifier", "call_id": "@Interaction ID"}` |
| Max wait | 15 s |
| Response template | `{{answer}}` (also available: `data.smsText`, `data.helplines`, `data.matchedSchemeId`) |
| If it fails | "माफ़ कीजिए, अभी जानकारी नहीं मिल पाई। किसान कॉल सेंटर 1800-180-1551 पर फ़ोन करें।" |

`question` and `language` are filled by the model (tool parameters); `caller` and `call_id` come from the
call-context variables (type `@` in the Body editor). `language` accepts `hi-IN`, `mr-IN`, `ta-IN`, `gu-IN`,
`en-IN` or a language name; without it the script of the question decides.

Test the tool from a terminal first:

```bash
curl -s https://<backend-host>/api/agent/answer -H "Authorization: Bearer $AGENT_TOOL_TOKEN" \
  -H 'Content-Type: application/json' -d '{"question":"पीएम किसान में कितना पैसा मिलता है?","language":"hindi"}'
```

## 3. Test, then put it on a number

1. **Test agent** in the dashboard (browser microphone): ask the golden questions in Hindi and Marathi.
2. **Deploy → Phone Numbers:** rent a number from Sarvam (or connect Exotel / Twilio / Plivo), then
   **Inbounds:** attach the GramSahayak agent to that number. Call it from any phone.
3. Every tool call shows on `/live` (channel IVR) and in the caller's history (session = caller phone).

## Honest limits

- Costs: Sarvam bills voice agents per minute (from ₹3/min); the signup credit is ₹100. Number rental
  terms (price, KYC) are shown in the dashboard; we have not verified them.
- SMS receipts are logged and shown on `/live`; `smsDelivery` is `"simulated"` until an SMS provider
  (CloudTalk credentials) is configured. The agent instructions therefore never promise an SMS.
- Latency per answer = Sarvam speech recognition + our tool (~0.7–1.5 s RAG on Groq) + Sarvam speech.
