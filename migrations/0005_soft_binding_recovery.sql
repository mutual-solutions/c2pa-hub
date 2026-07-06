alter table media_assets add column soft_binding_status text;
alter table media_assets add column soft_binding_resolver text;
alter table media_assets add column soft_binding_lookup_method text;
alter table media_assets add column soft_binding_manifest_id text;
alter table media_assets add column soft_binding_manifest_url text;
alter table media_assets add column soft_binding_similarity integer;
alter table media_assets add column soft_binding_recovered_at text;

alter table validation_attempts add column soft_binding_status text;
alter table validation_attempts add column soft_binding_resolver text;
alter table validation_attempts add column soft_binding_lookup_method text;
alter table validation_attempts add column soft_binding_manifest_id text;
alter table validation_attempts add column soft_binding_manifest_url text;
alter table validation_attempts add column soft_binding_similarity integer;

create index if not exists idx_media_assets_soft_binding_status on media_assets(soft_binding_status);
create index if not exists idx_media_assets_soft_binding_manifest on media_assets(soft_binding_manifest_id);
