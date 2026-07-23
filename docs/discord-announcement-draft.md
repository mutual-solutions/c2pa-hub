# Discord announcement — DRAFT

**Status: DRAFT — not posted. Yejun posts this manually.** Nothing in this
file should be sent by automation.

- Audience: C2PA community Discord (builders).
- Numbers verified against the hub's own daily snapshot API
  (`/api/history`, snapshot_date 2026-07-23). Re-check them the day of
  posting; the crawler and validator move daily.
- Discord caps a single message at 2000 characters. The post below is
  over that, so either post it in a thread/forum post (4000 cap) or
  split at the marker.

---

## Post body

I've been building a public C2PA conformance hub and it's at the point
where it's more useful shared than private: https://c2pa.mutual.solutions

What it does: crawls public media, validates manifests with c2patool
against the official trust list, and publishes what it finds. Only
trusted real/edited provenance shows up in default search; everything
else is queryable as diagnostics.

Current coverage, honestly stated (snapshot 2026-07-23): 1051 assets
crawled across 177 domains. Of those, 12 are in public search with
trusted, intact provenance (7 camera-capture, 5 edited-with-chain), 72
carry manifests from certs not on the trust list, and 933 are
stripped/unknown. That ratio is arguably the most interesting finding
on the site.

Pieces you might actually use:

- **/trust** — trust-list change tracker. Cert counts for the C2PA
  trust list (28) and TSA list (21), change history from the
  c2pa-org/conformance-public commit feeds, and the conforming-products
  list (134 entries) cross-referenced against signers we actually
  observe in crawled media. JSON at /api/trust-changes.
- **/landscape** — the ecosystem measured from the corpus: validation
  funnel, trust gap, signer-by-trust breakdown. Every number on the
  page is derived from crawled data, not vendor claims.
- **Public validator** — validation runs as GitHub Actions in the
  public repo (c2patool, every 15 minutes, HMAC pull/callback), so the
  classification pipeline is inspectable end to end.

[split here if posting as two messages]

- **MCP endpoint** — POST /mcp (JSON-RPC 2.0) with
  `search_c2pa_images` and `get_methodology`, if you want an agent to
  query the corpus.
- **Soft-binding resolver** — a C2PA Soft Binding API-compatible
  resolver at /soft-binding over the validated corpus: exact SHA-256
  (`com.mutual.sha256.v1`) and normalized source-URL
  (`com.mutual.reference-url.v1`) lookup. It's a corpus recovery
  service, not a universal watermark decoder. The validator can also
  query external soft-binding resolvers for assets that come back
  no_manifest.

Everything is Apache-2.0: https://github.com/mutual-solutions/c2pa-hub

If you maintain signed assets or know public sources worth crawling,
I'd like seeds — and I'd welcome corrections if you think any
classification is wrong. Full API and methodology are documented in the
README and at /methodology.
