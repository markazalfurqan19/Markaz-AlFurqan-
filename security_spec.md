# Security Specification — Sirna Buusii Miseensaa Al-Furqaan

## 1. Data Invariants
1. All Firestore reads and writes require verified Google authentication (`request.auth != null && request.auth.token.email_verified == true`), except `/test/{docId}` connectivity probe.
2. Members (`/members/{memberId}`) can only be created with `createdBy == request.auth.uid`, immutable `createdBy` on updates, and read/listed only by admins/owners or the registering user (`resource.data.createdBy == request.auth.uid`).
3. Contributions (`/contributions/{contributionId}`) require positive `amountETB > 0`, valid `paymentMethod` and `status`, `recordedBy == request.auth.uid` on create, immutable `recordedBy` on updates, and non-admins can only update editable payment fields (`amountETB`, `ethiopianMonth`, `ethiopianYear`, `paymentMethod`, `transactionReference`, `notes`, `status`, `updatedAt`).
4. Admin roles (`/admins/{adminId}`) can only be created, updated, or deleted by verified owners (`isOwner()`). Non-owners can only read their own role document (`adminId == request.auth.token.email`).
5. Center settings (`/settings/{settingId}`) can only be read (`get`) by verified signed-in users and modified/listed only by admins/owners.
6. Every document ID and string field enforces strict `hasAll` / `hasOnly` key allowlists, type checks, and `.size()` boundary caps.

## 2. Dirty Dozen Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated read of `/members/ALF-M-001`.
2. Signed-in user with `email_verified: false` claiming hardcoded owner email reading `/admins`.
3. Non-admin creating a member with `createdBy` set to another user's UID (Identity Spoofing).
4. Member creation with extra shadow field `isVerified: true` (Shadow Update).
5. Member update mutating `createdBy` to hijack ownership.
6. Contribution creation with `amountETB: -500` or `amountETB: 0`.
7. Non-admin listing `/members` without `where('createdBy', '==', uid)`.
8. Non-admin updating a contribution's `receiptNumber` or `memberId`.
9. Non-owner creating an `/admins/{email}` record to escalate privileges.
10. Injecting a 2000-character string into `memberId` or `fullName` (Resource Poisoning).
11. Non-admin deleting a member or contribution document.
12. Non-admin modifying `/settings/center`.
