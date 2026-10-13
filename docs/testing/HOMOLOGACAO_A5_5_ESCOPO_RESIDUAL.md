# Homologação A5.5 — escopos residuais

Data: 13/10/2026

Ambiente: aplicação local conectada ao projeto Supabase do STRATO

Tenant: `strato-demo`

## Objetivo

Confirmar, com sessões autenticadas reais do backend, os limites de Cadastro, Comercial, Configurações e escopo empresarial implementados na A5.5.

## Perfis usados

- administrador existente com visão consolidada;
- executivo comercial temporário vinculado a `rep-1`, com `portfolio:manage` e `settings:view`, sem `registry:view` e sem empresa em `company_scopes`.

O perfil temporário e as sessões foram criados somente para o ensaio.

## Resultados

| Verificação               | Administrador | Executivo segmentado | Resultado esperado                      |
| ------------------------- | ------------: | -------------------: | --------------------------------------- |
| sessão autenticada        |           200 |                  200 | aprovado                                |
| consulta de Operações     |           200 |                  200 | aprovado                                |
| operações visíveis        |             0 |                    0 | escopo vazio não amplia acesso          |
| consulta do Comercial     |           200 |                  200 | aprovado                                |
| leads/executivos visíveis |         2 / 2 |                1 / 1 | `rep-2` não vazou para `rep-1`          |
| dados institucionais      |             — |                  200 | `settings:view` funciona                |
| políticas efetivas        |             — |                  200 | `settings:view` funciona                |
| Cadastro                  |             — |                  403 | ausência de `registry:view` é bloqueada |

O Copiloto não acionou o provedor externo durante o ensaio. Seu contrato foi validado pelos testes automatizados: o navegador envia somente a pergunta; as fontes são lidas no servidor e filtradas por tenant, empresa e campos permitidos.

## Limpeza

Ao final foram removidos o estado comercial sintético, as duas sessões temporárias e o executivo temporário. A conferência retornou:

- usuários temporários: 0;
- sessões temporárias: 0;
- estados comerciais temporários: 0.

## Pendência relacionada, fora da A5.5

O ensaio deliberado entre dois tenants distintos continua na A5.1/P0. O ambiente atual possui somente o tenant operacional `strato-demo`; essa validação exige provisionar um segundo tenant controlado no roteiro de UAT.
