# HighLevel Custom Field Audit — RLC Location

**Location ID**: `eKU9X5pMPSlIjG2USRoE`
**Date**: 2026-02-11
**Purpose**: Inventory HL custom fields relevant to structured office types and candidate vetting pipeline

---

## Summary

| Category | Count |
|----------|-------|
| Total custom fields | 331 |
| Survey/candidate fields | 14 |
| Charter fields | 18 |
| Membership fields | 12 |
| Engagement scoring | 10 |
| Template boilerplate (Lead Magnet, Webinar, Live Event) | ~180 |
| Business/agency fields | ~40 |
| Policy survey questions | ~25 |
| UTM/tracking | 5 |
| Other | ~27 |

---

## Candidate/Survey Fields — Mapping to Structured Data

### Existing fields that map to `rlc_candidate_responses`

| HL Custom Field | HL ID | HL Type | Maps To | Notes |
|-----------------|-------|---------|---------|-------|
| Office Seeking | `fT8DwPVp0gTpw47hkJtO` | TEXT | `candidate_office` (free-text) → `office_type_id` | Currently free-text; needs migration to structured select |
| District | `E1Ld7CVTCu8ZWf0dcyJX` | TEXT | `candidate_district` | Works as-is; normalizeDistrict() handles format |
| County | `lRLGkCa8MbrOb5BiBggZ` | TEXT | `candidate_county` | Works as-is |
| Election Date | `KyOC0ZI5J9XRwR36gdOv` | DATE | `survey.election_date` | Survey-level, not candidate-level |
| Campaign POC | `pKYFrwsQZkS2DPmdXc7g` | TEXT | — | Not in DB schema; informational |
| Campaign POC Email | `FhV8qlkbOYjTgZoN6UuN` | TEXT | — | Not in DB schema |
| Campaign POC Cell Phone | `wj93ceTongGxZLgkCZDH` | TEXT | — | Not in DB schema |
| Candidate's Signature | `2MtILSGmJtlqhpmK8fzy` | TEXT | — | Privacy/disclosure agreement |

### Missing fields — need to CREATE in HL

| Proposed Field | HL Type | Maps To | Rationale |
|----------------|---------|---------|-----------|
| **Office Level** | SINGLE_OPTIONS | `office_type.level` | federal, state, county, municipal, judicial, special_district |
| **Office Type** | SINGLE_OPTIONS | `office_type_id` (via slug lookup) | Flat list of all 38 office types; replaces free-text "Office Seeking" |
| **Candidate State** | SINGLE_OPTIONS | `candidate_state` | 50 states + DC + territories; currently NO state field for candidates |

### Existing field that covers candidate state partially

HL has `Charter State` (SINGLE_OPTIONS, `8DT8V4uDJjYde7lyJbKq`) but that's the charter's state, not the candidate's race state. Need a separate `Candidate State` field.

---

## Charter Fields — Already Exist

| HL Custom Field | HL ID | Type | Notes |
|-----------------|-------|------|-------|
| Charter Name | `SfjpahmmUU5w0mS3vfZA` | TEXT | |
| Charter State | `8DT8V4uDJjYde7lyJbKq` | SINGLE_OPTIONS | Used for charter-level filtering |
| Charter County | `5FKaZ2fa8wATUkcr7pq6` | TEXT | |
| Charter Region (State) | `Bx8K2OJo6bWGR866JT6P` | TEXT | |
| Charter Region (National) | `mnDt7XcTSYG9TEwzIXz0` | SINGLE_OPTIONS | |
| Charter Website | `VTrIZe6mID7bl3vlNHdl` | TEXT | |
| Charter Email | `W4lkrBcFAjopZOqd0yA7` | TEXT | |
| Charter Phone Number | `WQlvAohI4zmzFDdqEUTP` | PHONE | |
| Charter About | `RUhnT78bpP44dl4dAa1w` | LARGE_TEXT | |

### Duplicate Charter Officer Fields

These fields appear TWICE with different IDs — likely from separate form imports:

| Field | ID #1 | ID #2 |
|-------|-------|-------|
| Charter Chair | `QTIOFD0nsvA5t17rx3uH` | `c8OTikxnSDF7JOKlxelF` |
| Charter Vice Chair | `RTgl3gPrkYwdQ4tHj0hJ` | `Yi2xqxgradelybzTkTDf` |
| Charter Secretary | `GRDS3pWTkPye72W76OpT` | `iMJlQyclBH5l4z9yYzkF` |
| Charter Treasurer | `XYnb5JmKlQNP8Me27Qoy` | `z8RzQGlFCW2vo0CxeSXp` |

**Recommendation**: Audit which ID is actively used in forms/workflows, then consolidate to one.

---

## Policy Survey Questions (Existing)

These are the candidate survey questions stored as HL custom fields. They represent the RLC's political alignment questionnaire.

| Field Name (truncated) | HL ID | Type |
|------------------------|-------|------|
| Role of federal government | `jn9FUvGsSVSH85WvcNlw` | CHECKBOX |
| Federal legislation pledges | `4DwjEAUA2oTCRmbhjfeD` | CHECKBOX |
| Congressional caucus pledges | `J55zak92vne4nStbsUER` | CHECKBOX |
| Constitutional Carry | `K6e3MWDxrmZG4Hunji6S` | RADIO |
| Red-flag laws | `wIYtuhfyPUkJPsF9B818` | RADIO |
| Gun violence | `YyqkX8MkyAk4yRbh6vvB` | LARGE_TEXT |
| Term limits | `g4KfKyUf7fXNyC7yT0HM` | SINGLE_OPTIONS |
| Climate Change | `5ooKhs10YuCR2DKfqcMj` | CHECKBOX |
| Critical Race Theory | `AL6PDudEhoVOMctIl4lZ` | RADIO |
| Education policy | `Zc8QTHEEqTCcd6ycW8OI` | CHECKBOX |
| Healthcare | `oNlJxXCgHe43OG9680Aa` | CHECKBOX |
| Marijuana policy | `esza92fCVZIOFr9SkXeq` | CHECKBOX |
| Vape regulation | `hsU5Gql2AN7WK5IKH0wL` | RADIO |
| War on Drugs | `JPC3rl01ytFEbnT97S30` | CHECKBOX |
| Covid response | `JcqVwBvkA8yyQu9MgPEw` | LARGE_TEXT |
| Vaccination mandates | `wHwJqzeAxgcBOhaGHmCQ` | CHECKBOX |
| Fauci accountability | `b7zAZuBIeoIw5JkioIW5` | CHECKBOX |
| Big Tech | `q1jdNDIdcq0Sl8ArwVir` | LARGE_TEXT |
| Federal bureaucracy SWAT teams | `cn3hdj8AdDomtWqnhD18` | CHECKBOX |
| Military intervention | `OxVVtbOXM8gmytLVjTGz` | CHECKBOX |
| War on Terror | `KUmJ5zPFTA572F89rw8o` | CHECKBOX |
| Foreign aid | `l1iDq3it7qy8lGKPwMI3` | CHECKBOX |
| International organizations | `dKC2kKVZ6YvN4UHvI4Hn` | CHECKBOX |
| National service / draft | `DuuuaerhDguBREEdh8Ww` | CHECKBOX |
| International trade | `na0xdDKaw0GWfaRxDAIk` | CHECKBOX |
| Border security | `vfALbBOU8locgA4uAZW3` | LARGE_TEXT |
| Election integrity | `Nt2EoqDH3CLcDYepPAXp` | LARGE_TEXT |
| Working-class wages | `qZNUCq6wPkRzcVXySNBw` | CHECKBOX |
| Ideal tax structure | `jkyU1z0Ts8cJdmTNM89n` | LARGE_TEXT |
| Budget spending | `mzV18HWnI8JkGYc9PviQ` | LARGE_TEXT |
| Debt ceiling | `zO5G2qNZOcTZ5EcC6b8Q` | LARGE_TEXT |
| Government shrink % | `ki1CBq3tU1MkRbSUsYE1` | TEXT |
| American Experiment | `M6IXf4HGeH9Esuh04sQ2` | LARGE_TEXT |
| Most important issue | `D9fvo50JYjyofYoTpT1e` | TEXT |
| Biggest threat to freedom | `FgnrvWyNF6RdqPWlEF4K` | TEXT |
| Ideological role model | `6zO6EHm8xqqdXuYs5spd` | TEXT |
| Stand with Massie | `6bElyCAmD3RewdXjLNYD` | CHECKBOX |
| Additional comments | `vnK5h0jYHYXCBHtuS3Ud` | LARGE_TEXT |

---

## Campaign Viability Fields (Existing)

| Field | HL ID | Type |
|-------|-------|------|
| Why seeking this office | `U77z2ZFcdmPrJqKKrnE8` | TEXT |
| Votes needed (primary) | `gLvFSjxH2S8Jp92SLwjD` | NUMERICAL |
| Votes needed (general) | `3T9TKTncQuWNLZyjnA4y` | NUMERICAL |
| Money needed (primary) | `68NdaGmV5RbauQVm0qmd` | NUMERICAL |
| Money needed (general) | `ds6PjwKCLRkLQeaUz27T` | NUMERICAL |
| Past election support (2016, 2020, 2024) | various | TEXT/TEXTBOX_LIST |

---

## Tags — Candidate Related

| Tag Name | HL ID |
|----------|-------|
| candidate | `HEF60Y3fpCnUasdGpH4r` |
| candidates | `3tN4H3zqdM1uDwsb6qX4` |
| officer | `g3x6NHuDDTXGFlmrugZI` |

**Note**: 149 total tags; only 3 relate to candidates. The `candidate` vs `candidates` tags are redundant — should consolidate.

---

## Template Boilerplate (~180 fields)

These are EAT/HL SaaS template fields auto-provisioned for every location. Not RLC-specific:
- Lead Magnet Page #1 (×14 fields)
- Webinar Live #1 (×24 fields)
- Webinar on Demand #1 (×24 fields)
- Live Event #1 (×28 fields)
- Business profile (×30 fields)
- Calendar URLs (×5 fields)
- Various engagement scoring (×10 fields)

These are NOT used for candidate vetting and can be ignored.

---

## Recommendations

### Immediate (this PR scope)
No HL changes needed. The structured office types live in the RLC website database. HL continues to collect free-text "Office Seeking" which is normalized by `scripts/migrate-office-data.ts`.

### Next PR: Survey Mirroring
1. **Create 3 new HL custom fields**:
   - `Office Level` (SINGLE_OPTIONS): federal, state, county, municipal, judicial, special_district
   - `Office Type` (SINGLE_OPTIONS): All 38 office type names
   - `Candidate State` (SINGLE_OPTIONS): 50 states + DC + territories

2. **HL → Website sync**: Webhook on contact.update → normalize Office Type text to `office_type_id` via slug lookup, update `rlc_candidate_responses`

3. **Limitation**: HL doesn't support cascading dropdowns natively. Options:
   - (a) Flat dropdown in HL form + webhook normalization (simplest)
   - (b) Redirect candidates from HL survey to RLC website for structured input (better UX, more work)
   - (c) Custom HL form with conditional visibility via JS (fragile, not recommended)

### Cleanup
- Consolidate duplicate charter officer fields (4 pairs, 8 fields → 4 fields)
- Consolidate `candidate` / `candidates` tags into one
- Audit which template boilerplate fields are actually used (likely none)
