alter table private.finance_states
  add column payload jsonb not null default '{}'::jsonb
  check (jsonb_typeof(payload) = 'object');

comment on column private.finance_states.payload is
  'Snapshot versionado do agregado para hidratação rápida; tabelas filhas mantêm as projeções consultáveis e as restrições fortes.';
