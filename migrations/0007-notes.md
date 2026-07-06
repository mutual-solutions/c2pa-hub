# 0007 Index Audit: Public Search Queries

**Finding: no new migration file created.**
The required index already exists in `0001_initial.sql` and is never dropped or modified by migrations 0002-0006.

---

## Schema baseline

Existing index on `media_assets` (from 0001_initial.sql, line 97):

```sql
create index if not exists idx_media_assets_public_search
  on media_assets(public_category, latest_validated_at desc, id desc);
```

No subsequent migration touches this index.

---

## Query 1 — buildAssetQuery

Representative SQL (baseline, no cursor, no LIKE):

```sql
SELECT id, url, domain, public_category, latest_validated_at, classification,
       signer, claim_generator, digital_source_type, ai_disclosure_present,
       manifest_present, trust_status, content_type, soft_binding_status
FROM media_assets
WHERE public_category IN ('real','edited')
ORDER BY latest_validated_at DESC, id DESC
LIMIT 25
```

### Before (existing index only)

```
SEARCH media_assets USING INDEX idx_media_assets_public_search (public_category=?)
USE TEMP B-TREE FOR ORDER BY
```

### With keyset cursor

```sql
WHERE public_category IN ('real','edited')
  AND (latest_validated_at < '2025-01-01T00:00:00.000Z'
       OR (latest_validated_at = '2025-01-01T00:00:00.000Z' AND id < 100))
ORDER BY latest_validated_at DESC, id DESC
LIMIT 25
```

```
SEARCH media_assets USING INDEX idx_media_assets_public_search (public_category=? AND latest_validated_at<?)
USE TEMP B-TREE FOR ORDER BY
```

### With LIKE filters

```
SEARCH media_assets USING INDEX idx_media_assets_public_search (public_category=?)
USE TEMP B-TREE FOR ORDER BY
```

### Root cause of temp sort

`IN ('real', 'edited')` forces SQLite to run two separate range scans on the composite index (one per value). The results come back sorted within each value's segment but interleaved across them; SQLite collects all matches into a temp B-tree to merge-sort before honoring the LIMIT. This is a planner behavior inherent to multi-value IN + composite index ORDER BY — it is not a missing index.

### Attempted fixes (proved ineffective)

**Partial index attempt:**

```sql
CREATE INDEX idx_test_partial ON media_assets(latest_validated_at DESC, id DESC)
  WHERE public_category = 'real' OR public_category = 'edited';
```

Result: SQLite's planner ignored it (still chose the composite index + temp sort). Forcing it with `INDEXED BY idx_test_partial` returned `SQLITE_ERROR: no query solution` — the planner cannot verify that `IN ('real', 'edited')` satisfies an OR-predicate partial index.

**Plain timestamp index:**

```sql
CREATE INDEX idx_test_ts_only ON media_assets(latest_validated_at DESC, id DESC);
```

When forced via `INDEXED BY`, the plan becomes `SCAN media_assets USING INDEX idx_test_ts_only` (no temp sort), but it reads every row in the table in timestamp order and filters — an O(n) full scan. The planner correctly rejects this as more expensive than the existing approach.

### Conclusion for Query 1

The `USE TEMP B-TREE FOR ORDER BY` is bounded by the count of rows where `public_category IN ('real', 'edited')`, not the total table size. These two categories are the primary corpus, so the sort set is nearly the full table regardless. No purely index-based migration can eliminate this without changing the query structure.

**If sort performance becomes a bottleneck at scale**, the application-level fix is to rewrite the query as `UNION ALL` (one branch per category value), which allows SQLite to walk each branch in index order and merge two already-sorted streams without a temp table. That is a code change in `src/index.ts`, not a migration.

---

## Query 2 — corpusStats

```sql
SELECT public_category, count(*), max(latest_validated_at)
FROM media_assets
WHERE public_category IN ('real','edited')
GROUP BY public_category
```

### Query plan

```
SEARCH media_assets USING COVERING INDEX idx_media_assets_public_search (public_category=?)
```

All columns needed (`public_category`, `latest_validated_at`) live in the index. SQLite never reads the table rows; it satisfies the entire query from the index alone. No temp sort, no table lookups. This is optimal.

---

## Summary

| Query | Index used | Temp sort? | Optimal? |
|-------|-----------|-----------|---------|
| buildAssetQuery (all forms) | idx_media_assets_public_search | Yes (unavoidable for IN + ORDER BY) | Acceptable — bounded by 'real'+'edited' row count |
| corpusStats | idx_media_assets_public_search (COVERING) | No | Yes |

**No 0007_public_search_indexes.sql created.** The existing composite index is correctly designed. The temp sort in Query 1 is a SQLite planner constraint, not a missing index.

---

## Remote apply command (if a migration file were needed)

No migration file exists, so there is nothing to apply. If a future migration is added, the lead should run:

```sh
npx wrangler d1 migrations apply c2pa-scanner-db --remote
```
