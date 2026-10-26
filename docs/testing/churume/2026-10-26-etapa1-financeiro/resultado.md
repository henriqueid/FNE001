# Etapa1 — Financeiro: jornadas principais

26/10/2026. Demonstração exclusiva em `http://127.0.0.1:5182/?design=refined&screen=app`, dados fictícios CHURUME, salvamento no navegador. Componentes reais; sem APIs ou dados produtivos. **Duas correções novas locais, não publicadas.** Produção permanece no lote6bf67f8.

## Matriz executada no navegador

| Caso | Resultado observado | Estado |
| --- | --- | --- |
| Formulário vazio | Botão Lançar desabilitado | APROVADO |
| Lançamento único R$123,45 | CP-00087 na empresa Lastro Prime FIDC, fornecedor e valor corretos; mensagem de criação | APROVADO |
| Nota parcelada R$100,00 | CP-00089/91/93:33,33+33,33+33,34; total100,00 | APROVADO |
| Fim de mês | Primeiro31/01/2026; próximos28/02 e31/03; valores preservados | APROVADO |
| Importação mista | Uma linha pronta; vencimento31/02, competência inválida e empresa inexistente sinalizados individualmente | APROVADO |
| Importar linhas prontas | Só CP-00095 de1.234,56 criado na Lastro Fomento Mercantil; outras três linhas não criadas | APROVADO |
| Transferência: mudar origem | Itaú→Sicredi no seletor de origem atualiza destino para Itaú; apenas mesma empresa | APROVADO |
| Transferência fictícia15,00 | MV-00097 saída Sicredi; MV-00098 entrada Itaú; saldos24.303,60 e1.219.012,60 | APROVADO |
| Conciliação por sugestão | Extrato120.000 e movimento120.000, diferença zero; CC-00100 criado | APROVADO |
| Desfazer | Os dois lados voltam a pendentes; mensagem explícita | APROVADO |
| OFX identificado748/88310-4 | CHURUME-etapa1.ofx: uma linha-16,00 com FITID próprio importada na Sicredi | APROVADO |
| Diferença | Extrato-16,00 versus movimento-15,00: conciliação direta bloqueada; diferença-1,00 apresentada | APROVADO |
| Lançar diferença | CP-00102/MV-00104 de1,00 baixado; grupoCC-00106 relaciona linha de16,00 à transferência15,00 e despesa1,00 | APROVADO |
| Conciliação automática | Um par restante de120.000 conciliado por valor/data; CC-00107, pendências da Sicredi zeradas | APROVADO |
| Teclado antes do fix | Escape não fechava; Tab focava aba Caixa e fluxo atrás da janela | FALHOU → CORRIGIDO |
| Teclado após fix | Foco inicial Fechar; Shift+Tab→Cancelar; Tab→Fechar; Escape fecha e devolve foco a Novo lançamento | APROVADO |
| Apresentação desktop | Capturas1280×720 das telas percorridas; abas em faixa horizontal, tabelas abaixo da dobra exigem rolagem | INSPECIONADO VISUALMENTE |

## Achados novos corrigidos

- **F01/P2 — teclado/foco:** Modal compartilhado do Financeiro só expunha aria-modal, sem gerenciamento de foco ou Escape. `finance-ui.tsx` agora foca primeiro controle disponível, contém Tab/Shift+Tab, fecha por Escape, devolve foco ao acionador conectado e remove listener ao desmontar. Callback atualizado sem reposicionar foco a cada edição. Navegador confirmou retorno ao botão acionador após reabertura normal. Três regressões RED→GREEN.
- **F02/P3 — mensagem monetária:** resultado de diferença exibia “Diferença de1.00”, sem moeda/pt-BR. `reconciliation.ts` formata R$1,00 apenas no texto; cálculo, lançamentos e histórico preservados. Uma regressão RED→GREEN; confirmação GREEN automatizada, sem novo lançamento no navegador para repetir só o aviso.

Nenhuma alteração de regra financeira, schema, autorização ou dependência. Dois arquivos de produto e dois de regressões; demais alterações do checkout preservadas. Não executada publicação.

## Evidências e verificações

- [Parcelas](parcelas.png), [importação](importacao.png), [transferência](transferencia.png), [conciliação](conciliacao.png), [modal](teclado.png).
- Árvores de acessibilidade finais: [conciliação](conciliacao-ax.txt), [foco inicial](teclado-ax.txt). Transições de Tab/Escape observadas diretamente durante execução; não inferidas da imagem.
- RED inicial: `teclado-red.log` e `moeda-red.log`; dirigido final:23 testes/2 arquivos aprovados em `dirigido.log`.
- `npm run check`: **1.181 aprovados/30 ignorados**,179 arquivos aprovados/6 ignorados; tipos, lint e formatação aprovados. Evidência `check.log`.
- `npm run build`: aprovado; evidência `build.log`.

## Limites e próximos blocos

Etapa1 cobre jornadas principais enumeradas, **não certifica todos os controles ou cenários do Financeiro**. Não executados nesta rodada: duplo clique com latência real, resposta tardia durante troca externa de conta/empresa, reimportação OFX no navegador, falha HTTP/SQL, teclado de todos os modais, leitor de tela e celular. Regressões anteriores de handlers/domínio desses casos continuam separadas da prova visual. Cadastro de bancos, liberação real, remessa/retorno bancário, períodos fechados e ações em massa não homologados por este percurso.

A auditoria produtiva anterior do banco/restauração permanece histórica; não repetir como prova destas novas interações de demonstração. Arquivo OFX gerado localmente, sem banco ou transferência real. Próxima etapa: Carteira/cobrança, com matriz própria. Acessos reais requerem servidor isolado posteriormente. Inventário geral permanece com pendências explícitas.
