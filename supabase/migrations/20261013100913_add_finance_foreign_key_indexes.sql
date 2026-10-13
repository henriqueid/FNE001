create index finance_journal_reversed_by_idx
  on private.finance_journal_entries(tenant_id, reversed_by);

create index finance_movements_reversal_of_idx
  on private.finance_movements(tenant_id, reversal_of);

create index finance_movements_reversed_by_idx
  on private.finance_movements(tenant_id, reversed_by);

create index finance_titles_category_idx
  on private.finance_titles(tenant_id, category_id);
