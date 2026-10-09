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
- **Enriquecimento:** associa automaticamente sacados existentes pelo CPF/CNPJ. Sacado que não existe na base é
  cadastrado automaticamente ao iniciar a operação, uma vez por CPF/CNPJ, com os dados do arquivo (no XML: razão
  social, fantasia, endereço, CEP, cidade/UF, telefone e e-mail do destinatário). Com endereço e CEP o cadastro
  nasce **Completo**; sem eles, **Provisório** até a complementação. A origem fica como Integração e a consulta
  cadastral pública continua pendente. A prévia mostra os sacados novos antes de confirmar; não é apontamento.
- **Auditoria:** o lote conserva nome do arquivo, formato, hash, instante da importação, quantidades e apontamentos.
- **Rastreabilidade:** os títulos normalizados passam a alimentar o mesmo modelo usado por Risco, Lastro, Preço e pelo
  Motor Universal de Elegibilidade.

## Limites conscientes

Leitores XLSX, layouts CNAB bancários, consulta oficial de NF-e e enriquecimento por Receita/bureau são integrações da
implantação produtiva. Enquanto não estiverem configurados, a interface bloqueia ou identifica a pendência; ela não
simula sucesso.
