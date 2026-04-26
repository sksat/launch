-- 0002_short_external_id.sql
-- Replace existing 36-char UUID v4 external_ids with 8-char URL-safe slugs.
-- New rows are generated as 8-char base62 by src/lib/short-id.ts; this
-- migration retroactively shrinks pre-existing rows so the URL form is
-- consistent everywhere. Old UUID URLs become 404 — accepted because the
-- service is internal and shared links are scarce.
--
-- D1/SQLite has no base62 helper, so we use lower(hex(randomblob(4))) for
-- the in-place rewrite (16 chars of charset instead of 62, but still 8
-- chars and URL-safe). The alphabets diverge from JS-side new rows but
-- both forms are 8-char opaque slugs and indistinguishable to users.
-- randomblob() is evaluated per row in UPDATE, so each row gets a fresh
-- value. Collision probability for the existing prod row count (<100) is
-- negligible against 16^8 ≈ 4.3 × 10^9.

UPDATE missions SET external_id = lower(hex(randomblob(4)));
