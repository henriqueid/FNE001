-- Rascunhos podem receber uma regra antes de o usuário preencher seu parâmetro.
-- A ativação continua exigindo ao menos uma regra habilitada e parametrizada.
alter table private.eligibility_policy_bindings
  alter column parameter drop not null;
