# STRATO · Receivables OS — protótipo navegável

Plataforma operacional de recebíveis para factoring, securitizadora, FIDC e ESC. Os dados são fictícios e todas as ações são simuladas no navegador (sem backend).

## Executar

1. Instale o Node.js 22 ou superior.
2. Nesta pasta, rode `npm install` e depois `npm run dev`.
3. Abra o endereço exibido no terminal.

Pré-visualização rápida sem Cloudflare/vinext: `npm run preview` (porta 5188).

## Roteiro de demonstração (5 minutos)

1. **Visão geral** — alterne Gestão / Operação / Risco e o recorte por empresa. Use `Ctrl K` para buscar qualquer operação, cedente ou módulo.
2. **Cadastros** — veja o comercial responsável, o limite do comitê e a carteira de cada cedente. Clique em **Novo cadastro**, marque os papéis (ex.: cedente e sacado) e salve: o cedente aparece na Nova operação e o sacado na digitação. Cadastre também um representante (vira comercial), um fornecedor ou um debenturista.
3. **Operações** — abra o aditivo da Rede Clínica (etapa Risco). Tente abrir uma etapa futura: ela fica travada até a atual ser concluída.
4. **Nova operação** — escolha o cedente: o comercial responsável aparece e é gravado na operação.
5. **Carteira** — títulos em aberto, atraso por faixa e qualidade da carteira por comercial.
6. **Comercial** — comitês atualizam o limite no Cadastro; recompras da Carteira estornam comissão; o envio ao Financeiro cria os títulos a pagar e o status de pagamento volta para a apuração.
7. **Financeiro** — baixe a comissão em A pagar e a receber e confira o status em Comercial › Comissões.
8. Alterne o **tema claro/escuro** no topo.

Para recomeçar: busca global (`Ctrl K`) › "Restaurar dados de demonstração".
