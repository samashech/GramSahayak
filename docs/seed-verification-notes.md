# Seed verification notes (K-04 → Lead, LD-02)

`/data/seed/schemes.json` and the three guides were written by an AI agent without web access. **Nothing in them is verified.** Every amount, threshold, helpline and portal must be checked against the official source by a human before the demo (LD-02). Marathi and Tamil text needs a native-speaker check.

## Riskiest claims — verify first

| # | Card | Claim | Why risky |
|---|---|---|---|
| 1 | PMMVY | helpline `1515` (was `14408`) | updated 2026-10-31 per LD-02 note (MWCD/Mission Shakti toll-free 1515); human confirmation still required |
| 2 | MGNREGA | helpline `1800-111-555` | national number; states also run their own |
| 3 | UJJWALA | helpline `1800-233-3555`; Rs 300/refill subsidy, 12 refills | subsidy amount changes by Cabinet decision |
| 4 | KCC | Rs 3 lakh subvention limit, 4% effective, Rs 2 lakh collateral-free | Budget 2025 announced raising the limit to Rs 5 lakh; check what is in force |
| 5 | PMAY | Rs 1.20 / 1.30 lakh; exclusion "income > Rs 15,000/month" | exclusion criteria were revised in 2024 |
| 6 | JSY | Rs 1,400 / Rs 700 rural, LPS state list | |
| 7 | PMMVY | Rs 5,000 (3,000 + 2,000), Rs 6,000 second girl child, income < Rs 8 lakh | PMMVY 2.0 rules |
| 8 | PMFBY | helpline `14447`; premium 2 / 1.5 / 5% | |
| 9 | NSP / PMYASASVI / PRAGATI | helpline `0120-6619540`; Rs 2.5 lakh and Rs 8 lakh limits; Pragati Rs 50,000 | |
| 10 | PMJAY | Rs 5 lakh; 70+ seniors covered since Oct 2024; helpline 14555 | |

## Deterministic-rule simplifications (R4)

The 9 rule keys cannot express every official criterion. These are the simplifications; the `eligibility` / `exclusions` text states the full criteria.

- **PMKISAN**: `occupations:["farmer"]`, `min_age:18`. Income-tax / government-employee exclusions are not modelled.
- **PMJAY**: `bpl_only:true` stands in for "in SECC / state list". The 70+ senior citizen route is not modelled.
- **JSY**: `pregnant_only`, `gender:"female"`. The HPS-state BPL/SC/ST condition is not modelled (it depends on the state, which the rules do not hold).
- **PMMVY**: `max_annual_income:800000` stands in for "at least one of the listed criteria".
- **PMAY**: `bpl_only:true`, `max_annual_income:180000` (Rs 15,000 x 12).
- **PMYASASVI**: `social_categories:["obc"]`. EBC and DNT students cannot be expressed with the contract vocabulary (`general|obc|sc|st`) → see change request CR-2 below.
- **PRAGATI**: "admitted to an AICTE degree/diploma" is not modelled; a Class 11 girl (Priya, `student-hi`) will show as eligible.
- **NSP**: `max_annual_income:250000` is a typical limit; real limits vary per scheme.

## G6 check (appendix golden query)

Profile: farmer, 1.0 ha, BPL yes, 35, female, not pregnant, income 90,000, obc.
Expected by these rules → **eligible**: PMKISAN, PMFBY, KCC, SHC, PMJAY, MGNREGA, UJJWALA, PMAY. **Not eligible**: JSY, PMMVY (not pregnant), NSP, PMYASASVI, PRAGATI (not a student).
This includes the five the appendix lists, plus PMFBY, KCC and SHC (she is a farmer).

## Category assignment

`schemes`: PMKISAN, MGNREGA, UJJWALA, PMAY · `agri`: PMFBY, KCC, SHC · `health`: PMJAY, JSY, PMMVY · `education`: NSP, PMYASASVI, PRAGATI.
Chosen so the golden queries match under the RAG category filter: G1 (schemes → PMKISAN), G5 (health → JSY), G7 (education → NSP).
