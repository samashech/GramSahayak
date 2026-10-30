# GramSahayak Mock Fixtures & Rehearsal Layer (FE-02)

This directory contains standalone mock data matching Contract v1 (`/docs/api-contract.md`) for zero-backend development, fast unit testing, and instant rehearsals.

## Fixture Query Mapping

| Fixture File | Contract ID | Query / Context | Persona & Language | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| `g1_pmkisan_hi.json` | **G1** | *पीएम किसान योजना के लिए कौन पात्र है?* | Ramesh (`farmer-hi`, `hi-IN`) | Matched `PMKISAN`, ₹6,000/yr in 3 installments, SMS card |
| `g2_cotton_pest_mr.json` | **G2** | *कापसावर गुलाबी बोंडअळी आली आहे, काय करावे?* | Tukaram (`farmer-mr`, `mr-IN`) | Pink bollworm IPM steps, Kisan Call Centre `1800-180-1551`, **no pesticide dose** |
| `g3_yellow_rust_hi.json` | **G3** | *गेहूं में पीला रतुआ रोग लगा है, क्या करें?* | Ramesh (`farmer-hi`, `hi-IN`) | Yellow Rust management guidance, KVK / `1800-180-1551` |
| `g4_pregnancy_ta.json` | **G4** | *கர்ப்பிணிப் பெண்ணுக்கு ஆபத்தான அறிகுறிகள் என்ன?* | Kavitha (`asha-ta`, `ta-IN`) | Danger signs, emergency hospital visit, `108`/`102` helplines, `safety.flagged: true` |
| `g5_jsy_ta.json` | **G5** | *ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?* | Kavitha (`asha-ta`, `ta-IN`) | Matched `JSY`, rural mother cash incentive, SMS card in Tamil |
| `g6_eligibility_hi.json` | **G6** | Family Profile: farmer, 1.0 ha, BPL yes, age 35, female, not pregnant, income ₹90k, OBC | Sunita (`panchayat-hi`, `hi-IN`) | Eligible: PMKISAN, PMJAY, UJJWALA, MGNREGA, PMAY; Ineligible: JSY, PMMVY |
| `g7_nsp_hi.json` | **G7** | *नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?* | Priya (`student-hi`, `hi-IN`) | Matched `NSP`, OTR registration steps, document checklist, SMS card |
| `g8_sms_pmkisan.json` | **G8** | Offline SMS body: `PMKISAN` | Farmer (`hi-IN`) | Direct keyword reply <= 160 chars with portal & helpline |
| `s1_snake_bite_hi.json` | **S1** | *सांप ने काट लिया है, अभी क्या करें?* | Ramesh (`farmer-hi`, `hi-IN`) | Emergency medical safety redirect, `108` ambulance, `safety.flagged: true` |
| `ivr_stages.json` | **IVR** | Interactive Feature Phone Call Simulation | All callers | Walks `greeting -> language -> category -> speech -> answer -> goodbye` with CloudTalk webhook logs |
| `profile.json` | **Profile** | User profile & interaction history | All users | Standard `user_profiles` schema and conversation history turns |
| `demo_reset.json` | **Reset** | `POST /api/demo/reset` | Lead / Judges | Resets demo personas to initial state |

## Enabling Mocks

Set environment variable in `.env.local`:
```bash
NEXT_PUBLIC_USE_MOCKS=true
```
When switched to `false`, `lib/api.ts` makes real network requests to the Node.js gateway at `http://localhost:5000`.
