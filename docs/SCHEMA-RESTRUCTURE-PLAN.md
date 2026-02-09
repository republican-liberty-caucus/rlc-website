# Schema Restructure: Contacts + Memberships Model

## Problem
Current schema has a single `rlc_members` table that combines contact information with membership data. This doesn't match the CiviCRM model and prevents proper contact/member separation and membership history tracking.

## Solution
Split into two tables following CiviCRM's architecture:
- `rlc_contacts` - Everyone in the database
- `rlc_memberships` - Membership records (1-to-many relationship)

---

## New Schema Design

### rlc_contacts
```prisma
model Contact {
  id                   String           @id @default(uuid())

  // Identity
  clerkUserId          String?          @unique @map("clerk_user_id")
  email                String?          @unique  // Now optional
  firstName            String           @map("first_name")
  lastName             String           @map("last_name")
  phone                String?

  // Address
  addressLine1         String?          @map("address_line1")
  addressLine2         String?          @map("address_line2")
  city                 String?
  state                String?
  postalCode           String?          @map("postal_code")
  country              String           @default("US")

  // Chapter affiliation
  primaryChapterId     String?          @map("primary_chapter_id")
  primaryChapter       Chapter?         @relation(fields: [primaryChapterId], references: [id])

  // External IDs
  highlevelContactId   String?          @unique @map("highlevel_contact_id")
  civicrmContactId     Int?             @unique @map("civicrm_contact_id")
  stripeCustomerId     String?          @unique @map("stripe_customer_id")

  // Preferences
  emailOptIn           Boolean          @default(true) @map("email_opt_in")
  smsOptIn             Boolean          @default(false) @map("sms_opt_in")
  doNotPhone           Boolean          @default(false) @map("do_not_phone")

  // Email validation (Reoon)
  emailValidatedAt     DateTime?        @map("email_validated_at")
  emailStatus          String?          @map("email_status")
  emailOverallScore    Int?             @map("email_overall_score")
  emailIsSafeToSend    Boolean?         @map("email_is_safe_to_send")
  emailIsValidSyntax   Boolean?         @map("email_is_valid_syntax")
  emailIsDisposable    Boolean?         @map("email_is_disposable")
  emailIsRoleAccount   Boolean?         @map("email_is_role_account")
  emailIsSpamtrap      Boolean?         @map("email_is_spamtrap")
  emailIsFreeEmail     Boolean?         @map("email_is_free_email")
  emailIsDeliverable   Boolean?         @map("email_is_deliverable")
  emailIsCatchAll      Boolean?         @map("email_is_catch_all")
  emailMxAcceptsMail   Boolean?         @map("email_mx_accepts_mail")

  // Household
  householdId          String?          @map("household_id")
  householdRole        HouseholdRole?   @map("household_role")
  primaryContactId     String?          @map("primary_contact_id")
  primaryContact       Contact?         @relation("HouseholdContacts", fields: [primaryContactId], references: [id])
  householdContacts    Contact[]        @relation("HouseholdContacts")

  metadata             Json             @default("{}")
  createdAt            DateTime         @default(now()) @map("created_at")
  updatedAt            DateTime         @updatedAt @map("updated_at")

  // Relations
  memberships          Membership[]
  roles                MemberRole[]     @relation("ContactRoles")
  grantedRoles         MemberRole[]     @relation("GrantedRoles")
  contributions        Contribution[]
  organizedEvents      Event[]
  positions            ChapterPosition[]
  surveyResponses      SurveyResponse[]
  eventRegistrations   EventRegistration[]

  @@map("rlc_contacts")
}
```

### rlc_memberships
```prisma
model Membership {
  id                   String           @id @default(uuid())

  // Link to contact
  contactId            String           @map("contact_id")
  contact              Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)

  // Membership details
  membershipTier       MembershipTier   @map("membership_tier")
  membershipStatus     MembershipStatus @map("membership_status")
  startDate            DateTime?        @map("start_date")
  expiryDate           DateTime?        @map("expiry_date")
  joinDate             DateTime?        @map("join_date")  // First ever join date

  // Payment tracking
  amount               Decimal?         @db.Decimal(10, 2)
  currency             String?          @default("USD")

  // External reference
  civicrmMembershipId  Int?             @unique @map("civicrm_membership_id")

  // Auto-renewal
  isAutoRenew          Boolean          @default(false) @map("is_auto_renew")
  stripeSubscriptionId String?          @map("stripe_subscription_id")

  metadata             Json             @default("{}")
  createdAt            DateTime         @default(now()) @map("created_at")
  updatedAt            DateTime         @updatedAt @map("updated_at")

  @@index([contactId])
  @@index([membershipStatus])
  @@index([expiryDate])
  @@map("rlc_memberships")
}
```

---

## Migration Steps

### Phase 1: Schema Changes (No Data Loss)
1. Create `rlc_contacts` table (duplicate of current `rlc_members` minus membership fields)
2. Create `rlc_memberships` table
3. Keep `rlc_members` table temporarily for data migration

### Phase 2: Data Migration
1. Copy all records from `rlc_members` to `rlc_contacts`
2. For each contact with membership data:
   - Create a record in `rlc_memberships`
   - Link via `contact_id`
3. Verify data integrity (counts match)

### Phase 3: Code Updates
1. Update all imports: `Member` → `Contact`
2. Update relations in other models:
   - `Contribution.member` → `Contribution.contact`
   - `MemberRole` → `ContactRole`
   - etc.
3. Update admin pages:
   - `/admin/members` → Shows contacts with active memberships
   - `/admin/contacts` → Shows all contacts
4. Update API routes and server actions

### Phase 4: Cleanup
1. Drop old `rlc_members` table
2. Rename database constraints
3. Update types/database.ts

---

## Benefits

✅ **Proper Data Model**
- Matches CiviCRM architecture
- Industry standard pattern

✅ **Membership History**
- Track renewals over time
- See membership changes
- Historical reporting

✅ **Clear Separation**
- `/admin/contacts` - Everyone (11,315)
- `/admin/members` - Active members only (~2,000-3,000?)
- Better UX and understanding

✅ **Flexibility**
- Contact can have 0, 1, or many memberships
- Easy to add membership types in future
- Supports complex membership scenarios

---

## Risks & Mitigations

**Risk:** Breaking existing functionality
**Mitigation:** Phase migration, keep old table until verified

**Risk:** Data loss during migration
**Mitigation:** Backup database first, verify counts at each step

**Risk:** Long migration time
**Mitigation:** Use batch operations, can run during low traffic

---

## Estimated Timeline

- **Schema design:** ✅ Complete
- **Migration script:** 1 hour
- **Data migration:** 10 minutes (11,315 records)
- **Code updates:** 2-3 hours
- **Testing:** 1 hour
- **Total:** 4-5 hours

---

## Open Questions

1. Do we want to import ALL CiviCRM membership records (for history) or just the current one?
2. Should we rename `MemberRole` to `ContactRole` for consistency?
3. Keep `member_id` in foreign keys or rename to `contact_id`?

---

## Next Steps

1. ✅ Get approval for this plan
2. Create Prisma migration for new schema
3. Write data migration script
4. Update codebase (search & replace Member → Contact)
5. Test thoroughly on production
6. Deploy

Ready to proceed?
