alter table media_assets add column cached_object_key text;
alter table media_assets add column cached_content_type text;
alter table media_assets add column cached_at text;

create table if not exists soft_binding_index (
  id integer primary key autoincrement,
  media_asset_id integer not null references media_assets(id) on delete cascade,
  validation_attempt_id integer not null references validation_attempts(id) on delete cascade,
  manifest_id text not null unique,
  alg text not null,
  content_sha256 text,
  byte_length integer,
  content_type text,
  reference_url text not null,
  normalized_url text not null,
  manifest_json text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_soft_binding_index_content_sha256 on soft_binding_index(content_sha256);
create index if not exists idx_soft_binding_index_normalized_url on soft_binding_index(normalized_url);
create index if not exists idx_soft_binding_index_media_asset on soft_binding_index(media_asset_id);
