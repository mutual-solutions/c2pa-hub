alter table media_assets add column platform_claim_source text;
alter table media_assets add column platform_claim_app text;
alter table media_assets add column platform_claim_issued_by text;
alter table media_assets add column platform_claim_issued_at text;
alter table media_assets add column platform_claim_ai_disclosure text;
alter table media_assets add column platform_claim_category_hint text;
alter table media_assets add column platform_claim_json text;

create index if not exists idx_media_assets_platform_claim_source on media_assets(platform_claim_source);
create index if not exists idx_media_assets_platform_claim_hint on media_assets(platform_claim_category_hint);
