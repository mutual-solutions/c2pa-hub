create table if not exists crawl_runs (
  id integer primary key autoincrement,
  source_type text not null,
  seed_url text,
  status text not null default 'queued',
  requested_limit integer not null default 20,
  release_ready integer not null default 0,
  pages_fetched integer not null default 0,
  media_candidates integer not null default 0,
  validations_completed integer not null default 0,
  failures integer not null default 0,
  methodology_version text not null default 'c2pa-hub-v2-2026-06-27',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists discovery_sources (
  id integer primary key autoincrement,
  crawl_run_id integer not null references crawl_runs(id) on delete cascade,
  source_type text not null,
  provider text not null,
  source_url text,
  query text,
  ordinal integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_discovery_sources_run on discovery_sources(crawl_run_id, ordinal);
create index if not exists idx_discovery_sources_type on discovery_sources(source_type);

create table if not exists source_pages (
  id integer primary key autoincrement,
  crawl_run_id integer not null references crawl_runs(id) on delete cascade,
  url text not null,
  normalized_url text not null unique,
  domain text not null,
  status text not null default 'queued',
  http_status integer,
  content_type text,
  robots_status text not null default 'not_checked',
  fetched_at text,
  error_detail text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_source_pages_run on source_pages(crawl_run_id);
create index if not exists idx_source_pages_domain on source_pages(domain);

create table if not exists media_assets (
  id integer primary key autoincrement,
  url text not null,
  normalized_url text not null unique,
  domain text not null,
  source_type text not null,
  source_url text not null,
  source_attribute text,
  source_ordinal integer not null default 0,
  status text not null default 'candidate',
  content_type text,
  byte_length integer,
  sampled_byte_length integer,
  sha256 text,
  classification text not null default 'stripped_or_unknown',
  public_category text not null default 'diagnostic',
  validation_status text not null default 'pending',
  signer text,
  claim_generator text,
  digital_source_type text,
  ai_disclosure_present integer not null default 0,
  manifest_present integer not null default 0,
  trust_status text,
  latest_validated_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_media_assets_public_search on media_assets(public_category, latest_validated_at desc, id desc);
create index if not exists idx_media_assets_domain on media_assets(domain);
create index if not exists idx_media_assets_classification on media_assets(classification);
create index if not exists idx_media_assets_signer on media_assets(signer);
create index if not exists idx_media_assets_source_type on media_assets(source_type);

create table if not exists fetch_attempts (
  id integer primary key autoincrement,
  media_asset_id integer not null references media_assets(id) on delete cascade,
  idempotency_key text not null unique,
  url text not null,
  status text not null,
  http_status integer,
  content_type text,
  byte_length integer,
  sampled_byte_length integer,
  sha256 text,
  prefilter_markers text not null default '[]',
  error_code text,
  error_detail text,
  elapsed_ms integer,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_fetch_attempts_asset on fetch_attempts(media_asset_id, created_at desc);

create table if not exists validation_attempts (
  id integer primary key autoincrement,
  media_asset_id integer not null references media_assets(id) on delete cascade,
  idempotency_key text not null unique,
  validator_name text not null,
  validator_version text not null,
  trust_list_version text,
  trust_list_ca_source_uri text,
  trust_list_tsa_source_uri text,
  trust_list_retrieved_at text,
  trust_list_ca_sha256 text,
  trust_list_tsa_sha256 text,
  trust_list_signature_status text,
  status text not null,
  classification text not null,
  public_category text not null,
  signer text,
  claim_generator text,
  digital_source_type text,
  ai_disclosure_present integer not null default 0,
  manifest_present integer not null default 0,
  ingredients_count integer not null default 0,
  actions_json text not null default '[]',
  raw_validator_json text,
  error_code text,
  error_detail text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_validation_attempts_asset on validation_attempts(media_asset_id, created_at desc);
create index if not exists idx_validation_attempts_status on validation_attempts(status);

create table if not exists validation_summaries (
  id integer primary key autoincrement,
  media_asset_id integer not null unique references media_assets(id) on delete cascade,
  validation_attempt_id integer not null references validation_attempts(id) on delete cascade,
  status text not null,
  classification text not null,
  public_category text not null,
  signer text,
  claim_generator text,
  validated_at text not null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_validation_summaries_public on validation_summaries(public_category, validated_at desc, media_asset_id desc);

create table if not exists validator_callback_nonces (
  id integer primary key autoincrement,
  key_id text not null,
  nonce text not null,
  seen_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique(key_id, nonce)
);

create table if not exists security_events (
  id integer primary key autoincrement,
  event_type text not null,
  key_id text,
  reason text not null,
  body_sha256 text,
  remote_addr text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_security_events_created on security_events(created_at desc);
