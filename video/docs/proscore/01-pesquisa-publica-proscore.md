# Pesquisa pública — proScore

Levantamento feito em 26/10/2026 somente em fontes públicas. Nada aqui descreve contrato, preço, endpoint
ou campo de API: o site não publica documentação técnica. Tudo o que for usado no vídeo deve ser
apresentado como oportunidade sujeita a validação conjunta.

## Quem é

- Bureau digital de crédito brasileiro, fundado em 2000, sede em São Paulo (SP) e unidade em Campinas.
  Assinatura: "Do Dado ao Resultado." ([LinkedIn](https://www.linkedin.com/company/proscoreoficial))
- Apresenta-se como especialista em Big Data, inteligência de dados, crédito, cobrança, prevenção a fraude,
  prospecção e higienização/enriquecimento de bases ([site](https://site.proscore.com.br/)).
- Realiza o evento Score Summit, onde lançou o **proX**, ferramenta de cruzamento informacional para
  ajudar instituições financeiras a cumprir a Resolução Conjunta nº 6 (compartilhamento de indícios de fraude)
  ([Seu Crédito Digital](https://seucreditodigital.com.br/proscore-lanca-nova-funcionalidade-antifraude-o-prox-confira/)).
- Alerta público: nunca ofereceu "aumento de score"; há golpistas usando a marca no WhatsApp.

## Linhas de solução publicadas

| Linha | O que o site diz | Fonte |
|---|---|---|
| **Plugins de Consulta** | "Mais de 90 plugins" de CPF/CNPJ montados pelo cliente. Exemplos: pro-cadastro PF/PJ (+ plus qualitativo), credipro PF/PJ (crédito simples, CCF, pendências restritivas, indicações de mercado), credipro-protesto PF/PJ. | [plugins](https://site.proscore.com.br/plugins-de-consulta) |
| **Authority de Score** | "Esteira 100% customizável e integrável a qualquer negócio"; cliente escolhe parâmetros e subcritérios; scores para crédito, risco e fraude; combina bases oficiais, dados não estruturados e dados do próprio cliente; "Todos os nossos serviços têm API integrável a qualquer sistema"; paga pelos parâmetros usados. | [authority](https://site.proscore.com.br/authority-de-score) |
| **Crédito e Risco** | Consultas prontas de crédito e cadastro PF/PJ; plataforma de score customizada; modelos de score prontos. | [crédito](https://site.proscore.com.br/credito-e-risco) |
| **Fraude e Compliance** | Classificação de risco de compliance (fraude, corrupção, concorrencial, privacidade, lavagem, conflito de interesses, PEP, terceiros); mapeamento de grupos econômicos (participações, administração, filiais); vínculos familiares; dossiês consolidados em uma consulta; localização de CPF/CNPJ a partir de nome. | [fraude](https://site.proscore.com.br/fraude-e-compliance) |
| **Prospecção e Inteligência de Mercado** | proXtract (extração de leads B2B filtrados), proGestor (higienização, padronização e enriquecimento de base), Zoomy (perfil e comportamento), match (CPF/CNPJ a partir de nome/razão social). | [prospecção](https://site.proscore.com.br/prospeccao-e-inteligencia-de-mercado) |
| **proAIssist** | "Assistente de Decisão Inteligente": IA sobre o retorno das consultas, relatórios estruturados e síntese de pontos de ação considerando variáveis e apetite de risco; custo adicional; público inclui mesas de análise, backoffices, comitês de crédito e diligência. | [proAIssist](https://proscore.com.br/proaissist/) |

Não encontrado publicamente: produto específico de cobrança, monitoramento contínuo de carteira, listas de
sanções, KYC documental/biometria, documentação de API (endpoints, campos, SLA). Itens a validar na conversa.

## Pontos de encaixe já existentes no STRATO (evidência no código)

| Encaixe | Evidência |
|---|---|
| Score interno 0–1000 por regras, com componente **"Score de bureau (externo)"** e **"Protestos e apontamentos"** | `src/domain/risk/quality-policy.ts`, `quality-scores.ts` |
| Catálogo de integrações com **Bureau**, **Protestos**, **PEP/sanções**, Receita, SEFAZ — em produção marcados como "não configurada" | `src/domain/integrations/model.ts` |
| Botão "Consultar bureau" na análise do sacado e pedido explícito de autorização antes da consulta (demonstração) | tela `operacao-risco`, `docs/architecture/PLANO_ESTRUTURA_IA.md` |
| Cadastro com grupos econômicos e papéis (cedente, sacado, avalista…) | tela Cadastros |
| Copiloto com fontes por resposta; fronteira externa fechada ("nenhum bureau é oferecido ao modelo") | `docs/ARCHITECTURE.md` §10 |

## Oportunidades que a pesquisa acrescenta ao roteiro

1. **Cadastro/onboarding** — pro-cadastro PF/PJ e proGestor para validar e padronizar cedentes e sacados; match para resolver nome → CNPJ.
2. **Compliance** — grupos econômicos e vínculos alimentando a **concentração por grupo** e o KYC do cedente; dossiê consolidado anexado à evidência da operação.
3. **Crédito/políticas** — atributos do credipro (CCF, pendências, protestos) como parâmetros determinísticos das políticas de elegibilidade; o "Score de bureau" ocupando o componente externo que o score interno já prevê.
4. **Operações orientadas a eventos** — consulta disparada só quando a regra pede (ex.: sacado novo, concentração alta), com autorização e custo controlados, em linha com o modelo "paga pelo que usa".
5. **Carteira** — reconsulta periódica ou por gatilho de deterioração (monitoramento contínuo não está publicado: validar).
6. **Cobrança** — match e proGestor para atualização de contatos e localização, respeitando finalidade/LGPD.
7. **Comercial** — proXtract/Zoomy para prospecção de cedentes.
8. **Copiloto** — sínteses do proAIssist como evidência externa citada, sem que a IA externa decida.
9. **Fraude regulatória** — proX/Res. Conjunta 6 é relevante para instituições reguladas pelo BCB; aplicabilidade a securitizadoras e FIDCs precisa ser avaliada.
