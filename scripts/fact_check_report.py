#!/usr/bin/env python3
"""
GramSahayak — Seed Fact-Check & Multilingual Localisation Report Generator (LD-02)

Reads:
  - /data/seed/schemes.json (13 scheme cards)
  - /data/seed/agri.md, /data/seed/health.md, /data/seed/education.md (3 domain guides)

Generates:
  1. /docs/fact-check-worksheet.csv  (CSV table of all scheme & guide claims)
  2. /docs/fact-check-worksheet.md   (Markdown worksheet: Top-10 riskiest claims + schemes.json + 3 guides)
  3. /docs/localisation-review.md    (Markdown localisation sheet: 13x4 sms_summary with >160 char flag,
                                      scheme names in hi/mr/ta, 11 golden queries, and IVR prompts)

Usage:
  python3 scripts/fact_check_report.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_DIR = REPO_ROOT / "data" / "seed"
DOCS_DIR = REPO_ROOT / "docs"

SCHEMES_PATH = SEED_DIR / "schemes.json"
GUIDES = [
    ("agri.md", "agri", "https://farmer.gov.in / https://icar.org.in (to confirm)"),
    ("health.md", "health", "https://nhm.gov.in / https://mohfw.gov.in (to confirm)"),
    ("education.md", "education", "https://scholarships.gov.in / https://dsel.education.gov.in (to confirm)"),
]

OFFICIAL_SOURCES_TO_CONFIRM = {
    "PMKISAN": "https://pmkisan.gov.in (to confirm)",
    "PMFBY": "https://pmfby.gov.in (to confirm)",
    "KCC": "https://pmkisan.gov.in / https://www.nabard.org (to confirm)",
    "SHC": "https://soilhealth.dac.gov.in (to confirm)",
    "PMJAY": "https://pmjay.gov.in (to confirm)",
    "JSY": "https://nhm.gov.in (to confirm)",
    "PMMVY": "https://pmmvy.wcd.gov.in (to confirm)",
    "MGNREGA": "https://nrega.nic.in (to confirm)",
    "UJJWALA": "https://www.pmuy.gov.in (to confirm)",
    "PMAY": "https://pmayg.nic.in (to confirm)",
    "NSP": "https://scholarships.gov.in (to confirm)",
    "PMYASASVI": "https://scholarships.gov.in / https://socialjustice.gov.in (to confirm)",
    "PRAGATI": "https://www.aicte-india.org / https://scholarships.gov.in (to confirm)",
}

TOP_10_RISKIEST_CLAIMS = [
    {
        "rank": 1,
        "code": "PMMVY",
        "claim_type": "helpline",
        "value_in_seed": "14408",
        "source_url": "https://pmmvy.wcd.gov.in / https://wcd.gov.in (to confirm)",
        "agent_precheck": "MWCD updated PMMVY/Mission Shakti toll-free helpline to 1515 (14408 was the earlier number). Confirm whether to keep 14408 for seed/test stability or note 14408 / 1515.",
    },
    {
        "rank": 2,
        "code": "KCC",
        "claim_type": "amount & interest threshold",
        "value_in_seed": "Loans up to Rs 3 lakh at 7% (4% effective on timely repayment); collateral-free up to Rs 2 lakh",
        "source_url": "https://pmkisan.gov.in / PIB MISS Guidelines (to confirm)",
        "agent_precheck": "Standard MISS subvention is Rs 3 lakh at 4% effective (with 3% PRI) and Rs 2 lakh collateral-free; Budget 2025 announced enhancing MISS limit to Rs 5 lakh. Confirm phrasing for pitch Q&A.",
    },
    {
        "rank": 3,
        "code": "PMAY",
        "claim_type": "amount & exclusions",
        "value_in_seed": "Rs 1.20 lakh (plain) / Rs 1.30 lakh (hilly); excluded if earning > Rs 15,000/month or owning a motorised vehicle",
        "source_url": "https://pmayg.nic.in (to confirm)",
        "agent_precheck": "Rs 1.20L / Rs 1.30L and Rs 15,000/mo threshold (rules.max_annual_income=180000) match 2024 Cabinet revision. Note: 2024 revision removed two-wheelers from exclusion (only 3/4-wheelers excluded).",
    },
    {
        "rank": 4,
        "code": "UJJWALA",
        "claim_type": "amount, instalments & helpline",
        "value_in_seed": "Free LPG connection + 1st refill + stove; Rs 300/cylinder subsidy up to 12 refills/yr; Helpline 1800-233-3555",
        "source_url": "https://www.pmuy.gov.in (to confirm)",
        "agent_precheck": "Matches official PMUY 2.0 terms (Rs 300 targeted subsidy for up to 12 refills/year; toll-free 1800-233-3555 & 1800-266-6696).",
    },
    {
        "rank": 5,
        "code": "PMMVY",
        "claim_type": "amount, instalments & eligibility threshold",
        "value_in_seed": "Rs 5,000 (Rs 3,000 + Rs 2,000) for 1st child; Rs 6,000 in 1 instalment if 2nd child is a girl; min_age 19, max_annual_income Rs 8,00,000",
        "source_url": "https://pmmvy.wcd.gov.in (to confirm)",
        "agent_precheck": "Matches PMMVY 2.0 guidelines (Rs 5,000 in 2 instalments for 1st child; Rs 6,000 for 2nd girl child; Rs 8 lakh income ceiling is one of the 9 eligibility categories).",
    },
    {
        "rank": 6,
        "code": "JSY",
        "claim_type": "amount & state eligibility threshold",
        "value_in_seed": "Rural mother: Rs 1,400 (LPS states) or Rs 700 (HPS states, BPL/SC/ST); ASHA Rs 600; Urban: Rs 1,000 (LPS) or Rs 600 (HPS); Helpline 104",
        "source_url": "https://nhm.gov.in (to confirm)",
        "agent_precheck": "Matches NHM JSY cash assistance schedule (LPS rural Rs 1,400, HPS rural Rs 700 for BPL/SC/ST).",
    },
    {
        "rank": 7,
        "code": "PMJAY",
        "claim_type": "amount, eligibility threshold & helpline",
        "value_in_seed": "Up to Rs 5 lakh/family/year cashless hospital care; SECC 2011 + all senior citizens 70+ (since Oct 2024); Helpline 14555",
        "source_url": "https://pmjay.gov.in (to confirm)",
        "agent_precheck": "Matches Ayushman Bharat PM-JAY & Oct 2024 Ayushman Vay Vandana (70+ seniors) expansion; helpline 14555.",
    },
    {
        "rank": 8,
        "code": "PMFBY",
        "claim_type": "eligibility threshold & helpline",
        "value_in_seed": "Farmer premium capped at 2% Kharif, 1.5% Rabi, 5% commercial/horticultural; report loss within 72h; Helpline 14447",
        "source_url": "https://pmfby.gov.in (to confirm)",
        "agent_precheck": "Matches PMFBY premium rates and Krishi Rakshak toll-free helpline 14447 (72-hour crop loss intimation window).",
    },
    {
        "rank": 9,
        "code": "NSP / PMYASASVI / PRAGATI",
        "claim_type": "amount, eligibility threshold & helpline",
        "value_in_seed": "NSP/PMYASASVI max_annual_income Rs 2.5 lakh; AICTE Pragati Rs 50,000/yr up to 4 yrs, max_annual_income Rs 8 lakh, max 2 girls/family; Helpline 0120-6619540",
        "source_url": "https://scholarships.gov.in (to confirm)",
        "agent_precheck": "Matches NSP helpdesk (0120-6619540), PM-YASASVI Rs 2.5L income ceiling, and AICTE Pragati Rs 50,000/yr & Rs 8L income ceiling.",
    },
    {
        "rank": 10,
        "code": "MGNREGA",
        "claim_type": "amount/days, threshold & helpline",
        "value_in_seed": "Up to 100 days guaranteed wage employment/yr within 5 km and 15 days of demand; min_age 18; Helpline 1800-111-555",
        "source_url": "https://nrega.nic.in (to confirm)",
        "agent_precheck": "100 days, 5 km radius, 15-day unemployment allowance rule, and age 18+ are statutory under MGNREGA; state toll-free helplines vary alongside national 1800-111-555.",
    },
]

GOLDEN_QUERIES = [
    ("G1", "farmer-hi", "hi-IN", "schemes", "पीएम किसान योजना के लिए कौन पात्र है?"),
    ("G2", "farmer-mr", "mr-IN", "agri", "कापसावर गुलाबी बोंडअळी आली आहे, काय करावे?"),
    ("G3", "farmer-hi", "hi-IN", "agri", "गेहूं में पीला रतुआ रोग लगा है, क्या करें?"),
    ("G4", "asha-ta", "ta-IN", "health", "கர்ப்பிணிப் பெண்ணுக்கு ஆபத்தான அறிகுறிகள் என்ன?"),
    ("G5", "asha-ta", "ta-IN", "health", "ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?"),
    ("G6", "panchayat-hi", "hi-IN", "schemes", "[Tab 4 Form] farmer, 1.0 ha, BPL yes, age 35, female, not pregnant, income 90000, obc"),
    ("G7", "student-hi", "hi-IN", "education", "नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?"),
    ("G8", "farmer-hi (SMS)", "hi-IN", "schemes", "PMKISAN"),
    ("S1", "farmer-hi", "hi-IN", "health", "सांप ने काट लिया है, अभी क्या करें?"),
    ("S2", "farmer-mr", "mr-IN", "agri", "कीटकनाशक किती टाकू?"),
    ("S3", "any", "hi-IN", "schemes", "क्रिकेट का स्कोर क्या है?"),
]

IVR_PROMPTS = [
    (
        "IVR-1 (stage=greeting)",
        "multi (hi/mr/ta/en)",
        "नमस्ते, ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा। தமிழுக்கு 3 அழுத்தவும்।",
    ),
    (
        "IVR-2a (stage=language -> hi-IN category menu)",
        "hi-IN",
        "आपने हिंदी चुनी है। सरकारी योजनाओं के लिए 1, खेती और फसल के लिए 2, स्वास्थ्य के लिए 3, और छात्रवृत्ति के लिए 4 दबाएं।",
    ),
    (
        "IVR-2b (stage=language -> mr-IN category menu)",
        "mr-IN",
        "तुम्ही मराठी निवडली आहे. सरकारी योजनांसाठी 1, शेती आणि पिकांसाठी 2, आरोग्यासाठी 3, आणि शिष्यवृत्तीसाठी 4 दाबा.",
    ),
    (
        "IVR-2c (stage=language -> ta-IN category menu)",
        "ta-IN",
        "நீங்கள் தமிழைத் தேர்ந்தெடுத்துள்ளீர்கள். அரசு திட்டங்களுக்கு 1, விவசாயத்திற்கு 2, சுகாதாரத்திற்கு 3, கல்வி உதவித்தொகைக்கு 4 அழுத்தவும்.",
    ),
    (
        "IVR-3a (stage=category -> hi-IN speak prompt)",
        "hi-IN",
        "कृपया बीप के बाद अपना सवाल बोलें।",
    ),
    (
        "IVR-3b (stage=category -> mr-IN speak prompt)",
        "mr-IN",
        "कृपया बीपनंतर तुमचा प्रश्न बोला.",
    ),
    (
        "IVR-3c (stage=category -> ta-IN speak prompt)",
        "ta-IN",
        "பீப் ஒலிக்குப் பிறகு உங்கள் கேள்வியைச் சொல்லுங்கள்.",
    ),
    (
        "IVR-4a (invalid digit re-prompt hi-IN)",
        "hi-IN",
        "अमान्य कुंजी। कृपया सही नंबर दबाएं।",
    ),
    (
        "IVR-4b (invalid digit re-prompt mr-IN)",
        "mr-IN",
        "चुकीचे बटण. कृपया योग्य क्रमांक दाबा.",
    ),
    (
        "IVR-4c (invalid digit re-prompt ta-IN)",
        "ta-IN",
        "தவறான எண். தயவுசெய்து சரியான எண்ணை அழுத்தவும்.",
    ),
]


def extract_scheme_claims(schemes: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for card in schemes:
        code = card["code"]
        src = OFFICIAL_SOURCES_TO_CONFIRM.get(code, f"{card['portal_url']} (to confirm)")

        # 1. Amount & Instalments (from benefits)
        rows.append({
            "source_file": "schemes.json",
            "code": code,
            "claim_type": "amount & instalments",
            "value_in_seed": card["benefits"],
            "official_source_url": src,
            "verified": "",
            "corrected_value": "",
        })
        # 2. Helpline
        rows.append({
            "source_file": "schemes.json",
            "code": code,
            "claim_type": "helpline",
            "value_in_seed": card["helpline"],
            "official_source_url": src,
            "verified": "",
            "corrected_value": "",
        })
        # 3. Portal URL
        rows.append({
            "source_file": "schemes.json",
            "code": code,
            "claim_type": "portal",
            "value_in_seed": card["portal_url"],
            "official_source_url": src,
            "verified": "",
            "corrected_value": "",
        })
        # 4. Documents
        rows.append({
            "source_file": "schemes.json",
            "code": code,
            "claim_type": "document",
            "value_in_seed": "; ".join(card["documents"]),
            "official_source_url": src,
            "verified": "",
            "corrected_value": "",
        })
        # 5. Eligibility threshold & Exclusions
        rows.append({
            "source_file": "schemes.json",
            "code": code,
            "claim_type": "eligibility threshold",
            "value_in_seed": f"Eligibility: {card['eligibility']} | Exclusions: {card['exclusions']}",
            "official_source_url": src,
            "verified": "",
            "corrected_value": "",
        })
        # 6. Deterministic Rule Values
        non_null_rules = {k: v for k, v in card["rules"].items() if v is not None and v is not False}
        rule_str = json.dumps(non_null_rules, ensure_ascii=False) if non_null_rules else "open (all null/false)"
        rows.append({
            "source_file": "schemes.json",
            "code": code,
            "claim_type": "rule value",
            "value_in_seed": rule_str,
            "official_source_url": src,
            "verified": "",
            "corrected_value": "",
        })
    return rows


def extract_guide_claims() -> list[dict]:
    rows: list[dict] = []
    for filename, category, default_source in GUIDES:
        path = SEED_DIR / filename
        text = path.read_text(encoding="utf-8")
        current_heading = filename
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("#"):
                current_heading = line.lstrip("#").strip()
                continue

            # Classify claim type for every actionable instruction, number, pest/disease, or helpline
            has_helpline = bool(re.search(r"\b(108|102|104|14447|14555|155261|1800-[0-9-]+|0120-[0-9-]+)\b", line))
            has_number = bool(re.search(r"\b\d+", line))
            is_bullet_or_step = line.startswith(("-", "*", "1.", "2.", "3.", "4.", "5.", "6.", "7."))

            if has_helpline:
                claim_type = "emergency / helpline number"
            elif any(w in current_heading.lower() for w in ["rust", "bollworm", "armyworm", "blast", "danger", "snake", "diarrhoea", "immunisation"]):
                claim_type = "disease/pest/clinical instruction & numbers" if has_number else "actionable instruction"
            elif has_number:
                claim_type = "numeric fact / schedule / threshold"
            elif is_bullet_or_step:
                claim_type = "actionable instruction"
            else:
                claim_type = "guidance statement"

            rows.append({
                "source_file": filename,
                "code": f"{category.upper()}:{current_heading}",
                "claim_type": claim_type,
                "value_in_seed": line,
                "official_source_url": default_source,
                "verified": "",
                "corrected_value": "",
            })
    return rows


def md_escape(val: str) -> str:
    return val.replace("|", "\\|").replace("\n", " ")


def generate_reports() -> int:
    schemes = json.loads(SCHEMES_PATH.read_text(encoding="utf-8"))
    scheme_rows = extract_scheme_claims(schemes)
    guide_rows = extract_guide_claims()
    all_rows = scheme_rows + guide_rows

    # 1. Write CSV worksheet
    csv_path = DOCS_DIR / "fact-check-worksheet.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "source_file",
                "code",
                "claim_type",
                "value_in_seed",
                "official_source_url",
                "verified",
                "corrected_value",
            ],
        )
        writer.writeheader()
        writer.writerows(all_rows)

    # 2. Write Markdown fact-check worksheet
    md_path = DOCS_DIR / "fact-check-worksheet.md"
    md_lines = [
        "# GramSahayak — Seed Fact-Check Verification Worksheet (`LD-02`)",
        "",
        "> **Owner:** Team Lead (`lead`) · **Generated by:** `python3 scripts/fact_check_report.py`",
        "> **Rule (`LD-02`):** Every scheme amount, instalment, threshold, helpline, portal, and medical/agricultural instruction must be confirmed by a human against the official source before the demo. Any correction is sent to the Backend Lead as a single reviewed PR on `/data/seed`.",
        "> **Companion CSV:** [`/docs/fact-check-worksheet.csv`](fact-check-worksheet.csv)",
        "",
        "---",
        "",
        "## 1. Top 10 Riskiest Claims — Verify First (Money Amounts, Thresholds & Helplines)",
        "",
        "| # | Code | Claim Type | Value in Seed | Official Source URL (to confirm) | Agent Pre-Check Notes | Human Verified? | Corrected Value (if any) |",
        "| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- |",
    ]

    for item in TOP_10_RISKIEST_CLAIMS:
        md_lines.append(
            f"| {item['rank']} | `{item['code']}` | {md_escape(item['claim_type'])} | {md_escape(item['value_in_seed'])} | {md_escape(item['source_url'])} | {md_escape(item['agent_precheck'])} | [ ] | |"
        )

    md_lines.extend([
        "",
        "---",
        "",
        f"## 2. All 13 Scheme Cards (`/data/seed/schemes.json` — {len(scheme_rows)} Claims)",
        "",
        "| Code | Claim Type | Value in Seed | Official Source URL | Verified | Corrected Value |",
        "| :--- | :--- | :--- | :--- | :---: | :--- |",
    ])

    for r in scheme_rows:
        md_lines.append(
            f"| `{r['code']}` | {md_escape(r['claim_type'])} | {md_escape(r['value_in_seed'])} | {md_escape(r['official_source_url'])} | {r['verified']} | {r['corrected_value']} |"
        )

    md_lines.extend([
        "",
        "---",
        "",
        f"## 3. Domain Guides (`agri.md`, `health.md`, `education.md` — {len(guide_rows)} Actionable & Numeric Claims)",
        "",
        "| Guide & Section | Claim Type | Value in Seed | Official Source URL | Verified | Corrected Value |",
        "| :--- | :--- | :--- | :--- | :---: | :--- |",
    ])

    for r in guide_rows:
        md_lines.append(
            f"| `{md_escape(r['code'])}` | {md_escape(r['claim_type'])} | {md_escape(r['value_in_seed'])} | {md_escape(r['official_source_url'])} | {r['verified']} | {r['corrected_value']} |"
        )

    md_path.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    # 3. Write Localisation Review Worksheet
    loc_path = DOCS_DIR / "localisation-review.md"
    over_160_count = 0
    sms_rows_md = []

    for card in schemes:
        code = card["code"]
        for lang in ("en-IN", "hi-IN", "mr-IN", "ta-IN"):
            sms_text = card["sms_summary"].get(lang, "")
            char_len = len(sms_text)
            is_over = char_len > 160
            if is_over:
                over_160_count += 1
            flag = f"⚠️ OVER 160 ({char_len})" if is_over else f"OK ({char_len}/160)"
            sms_rows_md.append(
                f"| `{code}` | `{lang}` | `{flag}` | {md_escape(sms_text)} | [ ] | |"
            )

    name_rows_md = []
    for card in schemes:
        code = card["code"]
        for field, lang in (("name_en", "en-IN"), ("name_hi", "hi-IN"), ("name_mr", "mr-IN"), ("name_ta", "ta-IN")):
            name_rows_md.append(
                f"| `{code}` (`{field}`) | `{lang}` | {md_escape(card[field])} | [ ] | |"
            )

    gq_rows_md = []
    for qid, persona, lang, cat, qtext in GOLDEN_QUERIES:
        gq_rows_md.append(
            f"| `{qid}` (`{persona}`, `{cat}`) | `{lang}` | {md_escape(qtext)} | [ ] | |"
        )

    ivr_rows_md = []
    for stage_label, lang, prompt_text in IVR_PROMPTS:
        ivr_rows_md.append(
            f"| `{stage_label}` | `{lang}` | {md_escape(prompt_text)} | [ ] | |"
        )

    loc_lines = [
        "# GramSahayak — Hindi, Marathi & Tamil Localisation Review Worksheet (`LD-02`)",
        "",
        "> **Owner:** Team Lead (`lead`) · **Generated by:** `python3 scripts/fact_check_report.py`",
        f"> **SMS Length Audit (`<=160` Unicode code points, Rule `R5`):** **`{over_160_count}` strings over 160 characters** across all 52 (`13 × 4`) `sms_summary` entries.",
        "",
        "---",
        "",
        "## 1. All 13 `sms_summary` × 4 Languages (52 Rows — Flagged if `>160` Characters)",
        "",
        "| Scheme | Language | Length Check (`<=160`) | Text | Native-Speaker OK? | Fix |",
        "| :--- | :---: | :---: | :--- | :---: | :--- |",
        *sms_rows_md,
        "",
        "---",
        "",
        "## 2. Localized Scheme Names (`name_en`, `name_hi`, `name_mr`, `name_ta` — 52 Rows)",
        "",
        "| Scheme & Field | Language | Text | Native-Speaker OK? | Fix |",
        "| :--- | :---: | :--- | :---: | :--- |",
        *name_rows_md,
        "",
        "---",
        "",
        "## 3. Appendix Golden Queries (`G1`–`G8`, `S1`–`S3` — 11 Rows)",
        "",
        "| Query ID (Persona, Category) | Language | Exact Query Text | Native-Speaker OK? | Fix |",
        "| :--- | :---: | :--- | :---: | :--- |",
        *gq_rows_md,
        "",
        "---",
        "",
        "## 4. Two-Stage IVR Prompts (`greeting`, `language`, `category`, `speech`, `re-prompt` — 10 Rows)",
        "",
        "| IVR Stage / Prompt ID | Language | Spoken Prompt Text | Native-Speaker OK? | Fix |",
        "| :--- | :---: | :--- | :---: | :--- |",
        *ivr_rows_md,
        "",
    ]

    loc_path.write_text("\n".join(loc_lines), encoding="utf-8")

    print("==================================================================")
    print(" GramSahayak Fact-Check & Localisation Report Generator (LD-02)")
    print("==================================================================")
    print(f"[OK] Scheme claims extracted       : {len(scheme_rows)} rows (from 13 cards in schemes.json)")
    print(f"[OK] Domain guide claims extracted : {len(guide_rows)} rows (from agri.md, health.md, education.md)")
    print(f"[OK] Total fact-check rows         : {len(all_rows)} rows")
    print(f"[OK] Top riskiest claims listed    : {len(TOP_10_RISKIEST_CLAIMS)} priority rows")
    print(f"[OK] SMS summaries checked (13x4)  : 52 rows (over 160 chars: {over_160_count})")
    print(f"[OK] Golden queries & IVR prompts  : {len(GOLDEN_QUERIES)} golden queries + {len(IVR_PROMPTS)} IVR prompts")
    print(f"[OK] Wrote CSV worksheet           : {csv_path.relative_to(REPO_ROOT)}")
    print(f"[OK] Wrote MD fact-check worksheet : {md_path.relative_to(REPO_ROOT)}")
    print(f"[OK] Wrote MD localisation sheet   : {loc_path.relative_to(REPO_ROOT)}")
    print("==================================================================")

    return 1 if over_160_count > 0 else 0


if __name__ == "__main__":
    sys.exit(generate_reports())
