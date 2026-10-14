drop index private.access_change_requests_requested_by_idx;
drop index private.access_change_requests_decided_by_idx;

create index access_change_requests_requested_by_idx
  on private.access_change_requests(tenant_id, requested_by);
create index access_change_requests_decided_by_idx
  on private.access_change_requests(tenant_id, decided_by)
  where decided_by is not null;
