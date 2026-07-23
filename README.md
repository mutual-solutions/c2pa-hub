# mutual C2PA Search

A public search hub for C2PA-validated images.

The product goal is not to inspect one file at a time. It discovers public media, validates C2PA manifests with `c2patool`, and exposes only trusted real or edited provenance in public search. AI-disclosed synthetic assets are excluded from default public results, while diagnostics remain available for audit.

Live:

- Public UI: https://c2pa.mutual.solutions
- Public API: `GET /api/assets`
- Corpus stats: `GET /api/stats`
- Methodology: `GET /api/methodology`
- Exports: `GET /api/export.json`, `GET /api/export.csv`
- MCP endpoint: `POST /mcp`

## UI

The home page at https://c2pa.mutual.solutions is a client-side search hub rendered by the Worker.

- **Search field and category tabs.** A text input searches across signer, generator, domain, and platform claim fields. Two tabs switch between Real and Edited categories. Pressing Enter or clicking Search fires the query.
- **Corpus stat strip.** On load the page fetches `GET /api/stats` and displays the total real count, edited count, and timestamp of the most recent validation.
- **Load more pagination.** Results are fetched in pages of 24 via `GET /api/assets`. When the response includes a `next_cursor` value, a Load more button appends the next page without a full reload.
- **Shareable search URLs.** The current query and category are reflected in the URL as `?q=&category=` query parameters. Sharing or bookmarking the URL restores the same search state.
- **Per-asset provenance detail dialog.** Each card has a Details button that opens a modal with the full provenance record: category, classification, signer, generator, domain, source type, content type, validation timestamp, and any platform claim fields captured from public page markup.
- **Click-to-filter.** Signer and generator values on cards are clickable buttons that set the search field and re-run the query.
- **Methodology page.** `GET /methodology` renders an HTML explanation of the classification rules, discovery sources, and limitations. A compact link to it appears in the site header and footer.
- **Social card.** `GET /og.png` is a static asset served from the `./public` directory and used as the Open Graph image for the site.
- **Test-asset library.** `GET /assets` lists validated samples with intact manifests, filterable by signer and category, with downloads of the exact cached bytes we validated.
- **Ecosystem landscape.** `GET /landscape` renders live charts from corpus aggregates: the provenance funnel, the trust gap, and per-signer trust breakdowns.
- **Resources.** `GET /resources` is a directory of community tools (viewers, specs, SDKs, signing certs, sample repos) plus this hub's data products.

## Public Taxonomy

- `real`: valid, trusted C2PA manifest with direct digital capture evidence.
- `edited`: valid, trusted C2PA manifest with edited/provenance-chain evidence back to capture.
- `excluded_ai_generated`: valid C2PA evidence of AI-disclosed synthetic media. Hidden unless `include_excluded_ai=true`.
- `diagnostic`: invalid, untrusted, no-manifest, unsupported, or stripped/unknown assets. Hidden unless `include_diagnostics=true`.

Absence of C2PA is treated as unknown, not as evidence of AI generation.

## Discovery

Release-ready crawl runs include multiple source classes:

- search API queries
- Common Crawl URL index probes
- public sitemaps
- RSS/Atom feeds
- known public C2PA repositories
- manual/public URL seeds

All candidate URLs pass public HTTP safety checks. Fetching uses bounded byte limits and prefilter marker scans; classification is only assigned after validator callback results.

Some platforms expose Content Credentials summaries in their public page markup even when their CDN rendition has stripped the embedded manifest. LinkedIn public CR badge attributes are captured as `platform_claim_*` diagnostic metadata (`app`, `issued_by`, `issued_at`, AI disclosure, and category hint). These fields are not treated as embedded C2PA validation; the media bytes still need to pass the normal validator before entering public `real` or `edited` search.

The validator can also query C2PA Soft Binding API-compatible resolvers after an asset returns `no_manifest` from embedded C2PA validation. This is the recovery path for watermark/fingerprint workflows: the watermark or fingerprint can point to an external manifest repository, but the whole manifest is not stored in the watermark itself. Recovered manifests are stored as `soft_binding_*` diagnostic metadata and remain outside public `real`/`edited` search until separately validated under the C2PA trust model.

The hub also exposes its own resolver at `/soft-binding` for the validated corpus it has already indexed. Version 1 supports exact content SHA-256 lookup (`com.mutual.sha256.v1`) and normalized source URL lookup (`com.mutual.reference-url.v1`). This is a corpus recovery service, not a universal TrustMark/watermark decoder.

Fetched image bytes are cached in R2 when the crawler receives a complete image response. The UI renders cards through `/api/image/{id}` instead of hotlinking original hosts, which keeps extensionless image URLs such as FotoForensics `analysis.php?...&fmt=orig` displayable when we have cached bytes and prevents source sites from controlling card rendering.

FotoForensics is treated as an analysis host, not capture provenance. FotoForensics-hosted assets remain diagnostic unless source context explicitly identifies the exact asset as a camera-original, edited example, or adversarial forgery. The current Pixel 10 allowlist is limited to exact originals documented in Hacker Factor's Pixel 10 C2PA post.

## Validation

The Cloudflare Worker queues validation attempts. A GitHub Actions validator pulls leased jobs from the Workers.dev machine endpoint, downloads each media asset, runs `c2patool 0.26.68` with the C2PA public trust list, and submits an HMAC-signed callback.

Validator job pulls are leased for 15 minutes to avoid duplicate work across scheduled/manual runs. Callback signatures include key id, timestamp, nonce, and body HMAC; callback nonces are stored to block replay.

Soft-binding recovery is configured with the `SOFT_BINDING_RESOLVERS` GitHub secret. The value is a JSON array:

```json
[
  {
    "name": "mutual-corpus-content",
    "endpoint": "https://c2pa.mutual.solutions/soft-binding",
    "alg": "com.mutual.sha256.v1",
    "lookup": "byContent",
    "maxResults": 5
  },
  {
    "name": "mutual-corpus-reference",
    "endpoint": "https://c2pa.mutual.solutions/soft-binding",
    "alg": "com.mutual.reference-url.v1",
    "lookup": "byReference",
    "maxResults": 5
  }
]
```

Supported lookup modes are `byContent` and `byReference`, matching the C2PA Soft Binding API paths `/matches/byContent`, `/matches/byReference`, and `/manifests/{manifestId}`.

## API Reference

All endpoints return JSON unless noted. Authenticated internal endpoints (validation job pull and callback) are not listed here.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Search hub HTML (rendered by Worker) |
| GET | `/methodology` | Methodology HTML page |
| GET | `/og.png` | Open Graph social card image (static asset, served from `./public`) |
| GET | `/api/assets` | Query the public corpus. See parameters below. |
| GET | `/api/assets/:id` | Single public asset by id. Returns 404 for non-public or unknown assets. |
| GET | `/api/stats` | Corpus totals: `real_count`, `edited_count`, `last_validated_at`, `methodology_version`. |
| GET | `/api/methodology` | Machine-readable methodology JSON (version, categories, limitations, discovery sources). |
| GET | `/api/export.json` | Full corpus export as JSON. Accepts the same query parameters as `/api/assets`. |
| GET | `/api/export.csv` | Full corpus export as CSV. Accepts the same query parameters as `/api/assets`. |
| GET | `/api/image/:id` | Proxy cached R2 image bytes for a corpus asset. |
| GET | `/api/recent` | The 25 most recently validated `real` and `edited` assets, ordered by validation timestamp. |
| GET | `/api/crawl-runs` | List the 50 most recent crawl runs and their status. |
| POST | `/api/crawl-runs` | Queue a new crawl run. Body: `{ "sources": [{ "type": "manual_seed", "value": "<url>" }] }`. |
| POST | `/mcp` | JSON-RPC 2.0 MCP endpoint. Supports `tools/list` and `tools/call` with `search_c2pa_images` and `get_methodology`. |
| GET | `/soft-binding/services/supportedAlgorithms` | Lists supported soft binding algorithms (`com.mutual.sha256.v1`, `com.mutual.reference-url.v1`). |
| POST | `/soft-binding/matches/byContent` | Look up a manifest by SHA-256 content hash. |
| POST | `/soft-binding/matches/byReference` | Look up a manifest by normalized source URL. |
| GET | `/soft-binding/manifests/:manifestId` | Retrieve a specific soft binding manifest by ID. |

### GET /api/assets parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Full-text search across signer, generator, domain, URL, and platform claim fields. |
| `category` | `real` \| `edited` | - | Filter to a single public category. Omit to return both. |
| `domain` | string | - | Exact domain match. |
| `signer` | string | - | Substring match on the C2PA signer field. |
| `generator` | string | - | Substring match on the claim generator field. |
| `classification` | string | - | Exact match on the internal classification value. |
| `limit` | integer | 100 | Page size. Clamped to 1–1000. The UI uses 24. |
| `cursor` | string | - | Opaque base64url cursor from `next_cursor` in a prior response, for keyset pagination. |
| `include_excluded_ai` | boolean | false | Include `excluded_ai_generated` assets in results. |
| `include_diagnostics` | boolean | false | Include `diagnostic` assets in results. |

The response includes `assets` (array), `next_cursor` (string or null), `limit`, and `limit_clamped`.

## API Examples

```bash
curl 'https://c2pa.mutual.solutions/api/assets?q=Proofmode&limit=10'
curl 'https://c2pa.mutual.solutions/api/assets?category=edited'
curl 'https://c2pa.mutual.solutions/api/assets?include_diagnostics=true&limit=25'
curl 'https://c2pa.mutual.solutions/api/export.csv?limit=1000'
curl 'https://c2pa.mutual.solutions/api/stats'
```

MCP search:

```bash
curl https://c2pa.mutual.solutions/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_c2pa_images","arguments":{"q":"Proofmode","limit":5}}}'
```

## Development

```bash
npm test            # run vitest test suite
npx tsc --noEmit    # type-check without emitting
npm run dev         # local Wrangler dev server
npm run deploy      # deploy to Cloudflare Workers
```

## Operations

```bash
npx wrangler deploy --dry-run
gh workflow run "C2PA Validator" --repo mutual-solutions/c2pa-hub --ref main
```

The scheduled Worker queues broad discovery every six hours (cron `17 */6 * * *`). The validator workflow runs every 15 minutes.
