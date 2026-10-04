# Entrada, normalização e enriquecimento — fundação V7

## Fluxo implementado

Arquivo → leitura → normalização → validação → deduplicação → vínculo cadastral → prévia → criação da operação.

- **XML NF-e:** extrai identificação da nota, chave, destinatário, CFOP e duplicatas.
- **CSV:** reconhece `;`, vírgula ou tabulação e aliases de cabeçalho em português ou inglês.
- **CNAB:** somente entra quando existe um leiaute delimitado reconhecível; arquivo posicional sem configuração é
  bloqueado com explicação.
- **XLSX:** não é tratado como se estivesse processado. A implantação atual solicita CSV UTF-8 até que o leitor XLSX
  seja conectado.
- **Deduplicação:** compara CPF/CNPJ do sacado + número do título dentro do arquivo e contra operações existentes.
- **Enriquecimento:** associa automaticamente sacados existentes pelo CPF/CNPJ. Identidades novas entram como cadastro
  provisório, preservando a origem e exigindo complementação posterior.
- **Auditoria:** o lote conserva nome do arquivo, formato, hash, instante da importação, quantidades e apontamentos.
- **Rastreabilidade:** os títulos normalizados passam a alimentar o mesmo modelo usado por Risco, Lastro, Preço e pelo
  Motor Universal de Elegibilidade.

## Limites conscientes

Leitores XLSX, layouts CNAB bancários, consulta oficial de NF-e e enriquecimento por Receita/bureau são integrações da
implantação produtiva. Enquanto não estiverem configurados, a interface bloqueia ou identifica a pendência; ela não
simula sucesso.
