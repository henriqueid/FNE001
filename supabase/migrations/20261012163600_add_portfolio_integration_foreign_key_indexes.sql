create index cnpj_jobs_requested_by_idx
  on private.cnpj_enrichment_jobs(requested_by);

create index cnpj_jobs_provider_idx
  on private.cnpj_enrichment_jobs(tenant_id, provider_id, capability);

create index import_batches_created_by_idx
  on private.import_batches(created_by);

create index integration_provider_configs_updated_by_idx
  on private.integration_provider_configs(updated_by);
