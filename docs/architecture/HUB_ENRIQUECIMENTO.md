# Hub de Enriquecimento

O Hub de Enriquecimento prepara e qualifica os dados antes da execução do Motor Universal de Elegibilidade. Ele não decide a operação: registra a origem, a confiança e a evidência disponível para cada informação.

## Estados de origem

- `INTERNO`: confirmado a partir do cadastro, da carteira ou da entrada normalizada do FNE001.
- `DEMONSTRACAO`: dado fictício usado para validar a experiência; nunca equivale a uma consulta oficial.
- `OFICIAL`: retorno de uma integração institucional configurada e homologada. Uma fonte pública ativa não recebe
  automaticamente essa classificação.
- `PENDENTE`: fonte sem credenciais/homologação ou cadastro que ainda precisa ser complementado.
- `INDISPONIVEL`: fonte configurada que não respondeu na execução.

## Fotografia por operação

Ao entrar em Risco, a operação recebe uma fotografia contendo:

- configuração das fontes;
- verificações por operação, cedente, sacado e título;
- resultado e proveniência de cada verificação;
- evidência e instante observado;
- resumo de cobertura.

Mudanças nos títulos ou na configuração geram uma indicação de desatualização. Uma nova execução preserva a fotografia anterior no histórico de auditoria.

## Integrações

As fontes são observadas em **Configurações > Integrações**. No ambiente real, CNPJ e CEP usam a BrasilAPI como fonte
pública quando a respectiva capacidade está ativa no servidor. O backend consulta a configuração persistida antes de
cada chamada e bloqueia a execução quando a capacidade está suspensa, degradada ou sem provedor ativo. SEFAZ,
bureaus, registradora, custodiante, funding e assinatura permanecem explicitamente não configurados até a conexão
institucional real.

O navegador recebe somente um retrato sanitizado da disponibilidade; configuração técnica e credenciais não são
expostas. Nenhuma fonte pública é promovida automaticamente para `OFICIAL`.
