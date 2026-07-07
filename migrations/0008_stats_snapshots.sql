-- Daily corpus + ecosystem snapshots for trend reporting.
create table if not exists stats_snapshots (
  id integer primary key autoincrement,
  snapshot_date text not null unique,
  total_assets integer not null,
  domains integer not null,
  classification_counts text not null default '{}',
  trust_cert_count integer,
  tsa_cert_count integer,
  conforming_product_count integer,
  methodology_version text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
