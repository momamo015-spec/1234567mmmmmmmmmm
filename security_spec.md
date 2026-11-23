# NOVA Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Owner-Only Isolation**: Every user profile (`/users/{userId}`) and subcollection item (`history`, `bookmarks`, `shortcuts`) is readable and writable exclusively by the authenticated owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
2. **Master Gate Sync**: Subcollection writes (`history`, `bookmarks`, `shortcuts`) verify the parent `/users/{userId}` document exists via `exists()`.
3. **Immutable Identity & Timestamps**: `uid` and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Strict Payload Boundaries**: Every document enforces exact key allowlists (`hasAll` + `hasOnly`), string `.size()` caps, and valid `isValidId()` path variables.
5. **No Blanket Reads or Client-Trusted Queries**: `/users` cannot be listed; subcollection `list` operations explicitly check `resource.data.uid == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/userA`.
2. Authenticated `userB` reading `/users/userA` (PII leak attempt).
3. Unverified email (`email_verified: false`) creating `/users/userA`.
4. `userA` creating `/users/userA` with `uid: "userB"` (identity spoofing).
5. `userA` creating `/users/userA` with an extra shadow field `isAdmin: true`.
6. `userA` updating `/users/userA` changing `createdAt` or `uid`.
7. `userA` creating `/users/userA` with a forged past `createdAt` instead of `request.time`.
8. `userA` creating `/users/userA` with a 1MB `displayName` string (DoW resource poisoning).
9. `userA` creating `/users/userA/history/bad$id` with invalid path characters.
10. `userA` creating `/users/userA/history/h1` when parent `/users/userA` does not exist (orphaned child).
11. `userB` listing `/users/userA/bookmarks` (cross-tenant list).
12. `userA` creating `/users/userA/bookmarks/b1` with `preferredEngine: "invalid"` or missing `url`.
