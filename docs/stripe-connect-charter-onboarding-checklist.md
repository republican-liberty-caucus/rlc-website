# Stripe Connect Express: Charter Onboarding Checklist

> What each RLC state charter needs to have ready before clicking "Connect Bank Account" in the admin panel.

## How It Works

Our system creates a **Stripe Connect Express** account with `business_type: non_profit`. Stripe hosts the entire onboarding form — we pre-fill the charter name and email, but Stripe collects everything else directly from the charter officer completing onboarding.

**Admin path:** `/admin/charters/{charterId}/banking` → "Connect Bank Account"

---

## What Stripe Will Ask For

### 1. Organization Information

| Field | Details | Notes |
|-------|---------|-------|
| **Legal business name** | Must match IRS records exactly (including capitalization) | Pre-filled from our system |
| **Business type** | Nonprofit organization | Pre-filled as `non_profit` |
| **Industry** | "Membership Organization" → "Charities or social service organization" | Charter officer selects during onboarding |
| **EIN (Employer Identification Number)** | 9-digit federal tax ID (XX-XXXXXXX format) | Required within 30 days or before $1,500 in charges |
| **Business address** | Physical headquarters address (city, state, ZIP) | Must be a real street address, not a P.O. Box |
| **Business phone number** | Organization's contact phone | |
| **Business website or description** | URL or description of what the organization does | Can use the charter's page on 2026.rlc.org |

### 2. Authorized Representative (Person Completing Onboarding)

The person who clicks through the Stripe onboarding form must be an **owner or executive** of the organization (e.g., President, Treasurer, Chairman, Secretary, Director).

| Field | Details | Notes |
|-------|---------|-------|
| **Full legal name** | First and last name as on government ID | |
| **Email address** | Personal or organizational email | Pre-filled from our system |
| **Date of birth** | MM/DD/YYYY | |
| **Home address** | Personal residential address | Used for identity verification |
| **SSN (last 4 digits)** | Social Security Number — last 4 digits initially | Full SSN may be requested if last-4 verification fails |
| **Phone number** | Personal contact number | |

### 3. Beneficial Owners & Directors

Stripe considers **all directors and key executives** as Ultimate Beneficial Owners (UBOs) for nonprofits. This includes anyone holding these titles:

- President
- Vice President
- Director
- CEO
- Treasurer
- Secretary
- Chairman
- Trustee
- Equivalent positions

For each person, Stripe may collect:
- Full name
- Date of birth
- Address
- Relationship to organization (title/role)

> **Note:** For small state charters with only 1-2 officers, this is typically just the person completing onboarding. Larger charters may need to list all board members.

### 4. Bank Account for Payouts

| Field | Details | Notes |
|-------|---------|-------|
| **Bank routing number** | 9-digit ABA routing number | |
| **Bank account number** | Checking or savings account number | |
| **Account holder name** | Must match the organization's legal name | |

> Stripe also supports linking via **Stripe Financial Connections** (Plaid-like instant bank link) as an alternative to manual entry. This is recommended to avoid routing/account number typos.

### 5. Identity Verification (If Requested)

Stripe may require additional identity verification for the authorized representative:

| Document | Accepted Types |
|----------|---------------|
| **Government-issued photo ID** | Driver's license, US passport, state ID card |
| **Selfie** | Photo taken during onboarding (compared to ID) |
| **Proof of address** | Utility bill, bank statement (if address can't be verified electronically) |

> ID documents must be uploaded as clear photos/scans — front AND back for driver's licenses and state IDs.

### 6. IRS Verification (If EIN Cannot Be Auto-Verified)

If Stripe can't verify the EIN electronically, they'll request one of:

| Document | What It Is |
|----------|-----------|
| **IRS Letter 147C** | EIN verification letter from IRS |
| **SS-4 Confirmation** | The original EIN assignment letter |
| **IRS Determination Letter** | 501(c)(4) or 501(c)(3) tax-exempt status letter |

### 7. Terms of Service

The authorized representative must accept Stripe's Connected Account Agreement on behalf of the organization.

---

## Pre-Onboarding Checklist (Give This to Charter Officers)

Before starting, gather:

- [ ] Organization's **EIN** (Employer Identification Number)
- [ ] Organization's **legal name** (exactly as registered with the IRS)
- [ ] Organization's **physical address** (street address, not P.O. Box)
- [ ] Organization's **phone number**
- [ ] Organization's **bank account** routing and account numbers (or online banking login for instant link)
- [ ] Authorized representative's **government-issued photo ID** (driver's license or passport)
- [ ] Authorized representative's **SSN** (at minimum last 4 digits)
- [ ] Authorized representative's **date of birth**
- [ ] Authorized representative's **home address**
- [ ] **IRS determination letter** (501(c)(4) status) — may not be needed, but good to have on hand
- [ ] Names and titles of **all board officers/directors** (Stripe may ask for beneficial owner info)

---

## What Happens After Onboarding

1. **Stripe verifies** the information (usually instant, sometimes 1-2 business days)
2. **Webhook fires** (`account.updated`) → our system marks the charter as `active`
3. **Pending ledger entries drain** — any accumulated split amounts transfer to the charter's bank account
4. **Going forward**: Every new membership payment splits automatically — $15 to National, remainder to the state charter via Stripe Transfer

## Troubleshooting

| Issue | Solution |
|-------|---------|
| EIN verification fails | Upload IRS Letter 147C or SS-4 confirmation |
| Identity verification fails | Upload clearer photo ID + selfie |
| Payouts disabled | Complete all required fields within 30 days |
| Wrong bank account | Charter officer can update via Stripe Express Dashboard |
| Onboarding link expired | Click "Connect Bank Account" again to generate a new link |

---

## RLC-Specific Notes

- **Business type:** RLC state charters are typically **501(c)(4)** social welfare organizations (not 501(c)(3) charities)
- **Industry selection:** "Membership Organization" → "Political Organization" or "Civic/Social Association" may be more accurate than "Charities"
- The **National charter** (ID: `992d53d0-f25a-45da-af27-67a4b82193f0`) does NOT need Stripe Connect — it keeps its $15 flat fee in the platform's own Stripe account
- Each state charter needs its **own separate** Stripe Connect account
- Our code pre-fills: charter name, email, `business_type: non_profit`, `country: US`, and requests `transfers` capability

---

## Sources

- [Stripe: Required Verification Information](https://docs.stripe.com/connect/required-verification-information)
- [Stripe: Express Connected Accounts](https://docs.stripe.com/connect/express-accounts)
- [Stripe: Stripe-Hosted Onboarding](https://docs.stripe.com/connect/hosted-onboarding)
- [Stripe: Identity Verification for Connected Accounts](https://docs.stripe.com/connect/identity-verification)
- [Stripe: Acceptable Verification Documents](https://docs.stripe.com/acceptable-verification-documents)
- [Stripe: Documents for Business Verification of Nonprofits](https://support.stripe.com/questions/documents-for-business-verification-of-unincorporated-entities-partnerships-or-non-profits)
- [Stripe: Tax Information for US Nonprofits](https://support.stripe.com/questions/tax-information-to-submit-when-signing-up-for-stripe-as-a-us-based-nonprofit-or-tax-exempt-organization)
- [Stripe: Manage Payout Accounts for Connected Accounts](https://docs.stripe.com/connect/payouts-bank-accounts)
- [Stripe: Connect Onboarding Requirements](https://support.stripe.com/questions/connect-platforms-manage-onboarding-and-risk-requirements-for-connected-accounts)
