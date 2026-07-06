alter table validation_attempts add column lease_owner text;
alter table validation_attempts add column lease_expires_at text;

create index if not exists idx_validation_attempts_lease on validation_attempts(status, lease_expires_at, created_at);
