create index if not exists company_profiles_created_by_idx on private.company_profiles(created_by);
create index if not exists company_profiles_updated_by_idx on private.company_profiles(updated_by);
create index if not exists registry_parties_created_by_idx on private.registry_parties(created_by);
create index if not exists registry_parties_updated_by_idx on private.registry_parties(updated_by);
create index if not exists registry_party_events_actor_idx on private.registry_party_events(actor_id);
