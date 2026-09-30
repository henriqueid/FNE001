# STRATO v6 — revisão completa e Fase 1

> Documento histórico da v6. Na v7 o código foi reorganizado em `src/` (ex.: `app/lib/registry.ts` agora é `src/domain/registry/registry.ts` e `operations-mvp.tsx` virou `src/app/strato-app.tsx` + `src/features/operations/`). Veja [ARCHITECTURE.md](../ARCHITECTURE.md).

30/09/2026 · revisão de todos os módulos, novo design system claro/escuro e vínculo único Cadastro → Operação → Carteira → Comercial → Tesouraria.

## 1. Resumo

- **O produto está no caminho certo.** Workspace contínuo da operação, precificação única reutilizada em todos os módulos, motor financeiro por partidas dobradas e regras "nada é apagado" são diferenciais reais e foram mantidos.
- **O problema era de costura, não de ideia.** Cada módulo tinha a sua própria versão do cliente, da meta e da carteira. Os números não batiam entre telas, quatro itens do menu não levavam a lugar nenhum e havia bugs que permitiam aprovar uma operação fora de ordem.
- **A Fase 1 resolveu a costura e a aparência:** design system com tema claro e escuro, shell novo com busca global real, Cadastros e Carteira funcionando e o Comercial ligado às demais áreas por um registro único do cliente.

## 2. O que foi entregue na Fase 1

### Design system e shell

- Tema **claro e escuro** (e "sistema"), alternado no topo ou pela busca. O escuro foi gerado para todas as telas existentes: as 949 cores soltas do CSS viraram tokens com valor claro e escuro (`tools/theme_tokens.py`).
- `app/globals.css` virou um índice: `styles/tokens.generated.css`, `legacy.css`, `commercial.css` e `design-system.css`. Removidos ~28 KB de CSS morto (prefixo `hd-`).
- **Comercial recuperado:** todo o CSS `cm-` tinha sumido (gráfico com barras pretas, listas sem estilo). Foi recuperado do build v5 e tokenizado.
- Fonte mínima de 10–11 px (havia 690 declarações abaixo disso, incluindo 7 px).
- Sidebar nova agrupada (Operação, Gestão, Plataforma), recolhível, com gaveta e barra inferior no celular.
- **Busca global `Ctrl K` / `/`:** operações por aditivo, borderô, cedente, CNPJ, veículo ou etapa; navegação por módulo; ações (nova operação, tema, restaurar demonstração).
- **Sino com alertas reais:** bloqueios, liberações pendentes e ritmo fora do padrão, com atalho para a operação.
- Selo "Demonstração" no lugar de "Ambiente seguro" (os dados são fictícios).
- Camada visual: gradiente de marca nos botões primários, cabeçalhos padronizados, identificadores em fonte mono, números tabulares, fundo técnico com grade sutil, modais com desfoque.

### Vínculo único do cliente (pedido do Henrique)

Novo `app/lib/registry.ts` com o registro do cliente por CNPJ, compartilhado por contexto React:

| De → para | Regra implementada |
|---|---|
| **Cadastro → Comercial** | Todo cedente tem comercial responsável. Os 10 clientes que só existiam no Comercial entraram no cadastro com dados de crédito coerentes. Cadastros permite vincular e transferir (com motivo). |
| **Comercial (comitê) → Cadastro** | A decisão do comitê atualiza o limite aprovado do cedente, que é o que a operação, a Visão geral e a Carteira usam. A trilha do comitê registra "Cadastro atualizado". |
| **Cadastro → Operação** | A operação grava o comercial responsável quando nasce (`commercialRepId`). O modal de nova operação e o cabeçalho do workspace mostram o comercial. |
| **Operação → Comercial** | Negócio usa a **data de liberação** (antes era sempre "hoje") e o comercial gravado na operação (ou o dono do cliente naquela data). |
| **Operação → Carteira** | Títulos das operações liberadas entram na Carteira com o veículo da operação. |
| **Carteira → Comercial** | Recompras feitas nas operações viram eventos da carteira e **estornam a comissão** do dono do cliente no mês do evento, com memória de cálculo. Carteira em aberto e vencido > 30 dias aparecem por comercial. |
| **Comercial → Tesouraria** | "Enviar ao financeiro" cria os títulos a pagar (já existia). Agora a apuração mostra **a situação de cada pagamento na tesouraria** (a pagar, paga, cancelada). |

O estado comercial saiu do componente e passou a viver no app, então Cadastros, Carteira e Comercial leem e gravam o mesmo dado. "Restaurar dados de demonstração" agora zera operações, cadastro comercial e financeiro juntos.

### Módulos novos

- **Cadastros v1:** cedentes com comercial, score, limite aprovado (comitê), uso do limite, carteira em aberto e operações em andamento; linha expansível com relacionamento, crédito, comitês e operações; transferir e vincular comercial; aba de sacados com exposição e origem (sacado provisório da digitação sinalizado).
- **Carteira v1:** títulos em aberto com filtro por situação e comercial, visão por cedente, por comercial (qualidade da carteira e recompras) e atraso por faixa.
- **Políticas e Integrações:** página de escopo com o que vem na Fase 2 e atalhos para onde as funções estão hoje (antes eram botões sem ação).

### Correções

| Módulo | Correção |
|---|---|
| Operações | Etapas futuras ficam **travadas** até a atual ser concluída (antes dava para aprovar uma operação que estava em Preço). Operação cancelada fica só para consulta. |
| Operações | Título reprovado não trava mais a operação: basta decidir todos e ter pelo menos 1 aprovado. |
| Operações | "Aprovar elegíveis" respeita a política (sacado com score ≥ 600, prazo ≥ mínimo) e não sobrescreve reprovações manuais. |
| Operações | A Central abre em "Histórico" (antes abria em "Hoje" e mostrava 0 operações). |
| Operações | Busca por campos visíveis (antes pesquisava o JSON inteiro: "status" devolvia tudo). |
| Operações | Parcelas: o desconto é rateado (antes repetia em cada parcela) e o rascunho é limpo. |
| Operações | Operação 3407 apontava para sacados errados; criados os 3 sacados corretos. Contagem do menu unificada. Erros de TypeScript zerados em `app/`. |
| Visão geral | O recorte por empresa agora chega à carteira, aging, concentração e alertas; a meta é proporcional à empresa. |
| Financeiro | Parser monetário único pt-BR ("1.500,55"): o saldo de abertura não grava mais valor errado. A carteira entra na projeção de caixa só da empresa certa. |
| Comercial | Comissão do Painel igual à da aba Comissões (bônus de conta nova era contado duas vezes). Carteira transferida não gera bônus de conta nova. |
| Documentação | Removidas as referências a sistemas de terceiros (`INSTRUCOES.md`, HANDOFF e pesquisa). `INSTRUCOES.md` reescrito com roteiro de demonstração. |

## 3. Revisão por módulo

### Operações

**Está bom:** workspace contínuo com etapas e registro de quem concluiu; precificação consistente; versões de condição comercial com motivo; recompra e compensação com grupo econômico; score explicável; pré-checagem com checklist e telefone oculto (LGPD); ritmo comparado ao histórico do cliente; cancelamento com memória.

**Melhorar (Fase 2):**

- Invalidação por assinatura de conteúdo: mudar Risco, Lastro ou Preço depois da aprovação deve derrubar aprovações e assinaturas.
- Origens XML, CNAB, Planilha e CCB ainda nascem sem títulos e param no Lastro. Gerar títulos simulados e reativar a leitura de DANFE/CMC7 do protótipo v5.
- Preço e Aprovação muito longos (2.100 px e 3.200 px, líquido repetido 5 vezes): resultado em destaque e detalhes recolhidos.
- "Reprovar operação" deve oferecer encerrar; documentos calculados não devem aceitar clique manual; "ROA projetado" está com rótulo errado.
- Modais com Esc e foco preso; tooltips acessíveis por teclado.

**Redirecionar:** cadastro rápido de sacado → grava como provisório em Cadastros; prazo mínimo, piso de taxa, amostra de checagem, teto de concentração e alçadas → Políticas; análise completa do cedente e extrato do sacado → Carteira (a operação mostra resumo com link); consultas Receita/Serasa e provedor de assinatura → Integrações; bloco "Resultado financeiro" da Central duplica a Visão geral.

### Visão geral

**Está bom:** métricas puras e testáveis, perfis com layout próprio, comparação com período equivalente, estados vazios cuidados.

**Melhorar:** inadimplência hoje conta a partir de D+1 (38,8%, alarmista) — usar faixa > 30 dias; "limite usado" soma operações ainda em Risco — rotular "comprometido se aprovar"; ritmo da meta mensal ignora dias úteis; eixos dos gráficos de caixa começam em zero e escondem a variação; no perfil Risco há dois blocos de atraso iguais.

**Redirecionar:** esteira e "Precisa de você" completos ficam na Central; projeção de caixa completa fica no Financeiro; aging, concentração e alertas passam a ser resumo com link para a Carteira.

### Financeiro

**Está bom:** motor transacional que recusa lançamento desbalanceado; estorno por contrapartida; pergunta "o dinheiro já saiu?"; contas-chave com de-para; devolução da operação em ordem inversa; conciliação com sugestão de par.

**Melhorar (bugs confirmados na auditoria):**

- A compra joga IOF, garantia, retenção e recompra na mesma conta 2.1.3; IOF deveria ir para 2.1.4.01 com título a pagar.
- Excluir ou editar o saldo de uma baixa parcial não estorna a contabilidade.
- Transferência interna some do fluxo quando se filtra por conta.
- Deságio nunca é apropriado (a DRE sai sem a principal receita).
- "Crédito a identificar" não baixa o título certo; conciliação automática casa movimentos estornados.
- Balancete e DRE "consolidados" somam entidades separadas (FIDC, securitizadora, factoring).

**Redirecionar:** remessa/retorno de cobrança → Carteira; aba Bancos, plano de contas e contas-chave → Configurações; Contábil → menu próprio "Controladoria", por entidade.

### Comercial

**Está bom:** atribuição pela data do vínculo, congelamento da regra no fechamento, memória de cálculo da comissão, validação das decisões do comitê, envio ao Financeiro com categoria e conta criadas quando faltam.

**Melhorar:** metas também em volume e contas novas (unificar com a meta da Visão geral); "Precisa de atenção" deve considerar o ritmo do mês; visitas futuras não podem ser registradas como realizadas; comissão paga na liquidação (opcional por regra).

**Redirecionar:** comitê e limites pertencem ao módulo de Crédito — o Comercial envia o pedido e acompanha.

### CSS e base técnica

- Antes: 341 KB, 913 cores distintas, 472 seletores repetidos, 59 `!important`, 39 tamanhos de fonte.
- Agora: tokens claro/escuro gerados, CSS morto removido, arquivos separados por papel.
- Próximo passo: quebrar `operations-mvp.tsx` (≈290 KB num arquivo) em arquivos por etapa; stylelint com `no-duplicate-selectors`; testes do motor financeiro e das regras comerciais.
- `vite.config.ts` depende de `./build/sites-vite-plugin`, que está no `.gitignore` e não veio na pasta: o `npm run dev` oficial precisa desse arquivo. Para revisar sem ele: `npx vite --config .preview/vite.config.mjs`.

## 4. Roadmap

| Fase | Escopo |
|---|---|
| **Fase 2** | Financeiro (IOF, apropriação do deságio, conta gráfica do cedente, contabilidade por entidade) e Carteira (CNAB, crédito a identificar, régua de cobrança). Operações: invalidação por assinatura, origens com títulos, Preço/Aprovação enxutos. |
| **Fase 3** | Políticas versionadas (tirar parâmetros do código), Crédito (comitê e limites), Integrações com status e logs, portal do cedente. |
| **Fase 4** | Backend real (API, PostgreSQL, fila de eventos, perfis e alçadas, trilha de auditoria) e integrações reais. |

## 5. Como validar

1. Rode a pré-visualização e use `Ctrl K` › "Restaurar dados de demonstração" (o armazenamento local antigo guarda dados da v5).
2. Siga o roteiro de `INSTRUCOES.md`.
3. Alterne o tema claro/escuro e teste no celular.
