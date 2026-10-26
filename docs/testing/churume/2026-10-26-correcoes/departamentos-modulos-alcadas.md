# Departamentos, módulos e alçadas

Estado em26/10/2026. Contrato vigente: `docs/ARCHITECTURE.md`; este documento registra homologação e extensão ainda não implementada.

## Disponível e exercitado

- Configurações → Usuários e acesso: identidade, situação, função, área principal, áreas acumuladas, gestor, empresas, permissões por ação/módulo e competência formal de crédito.
- Cadastro novo permanece em análise e sem permissões. Liberação exige administrador ou proposta governada; gestor não aprova a própria ampliação. Suspensão revoga sessões; reativação exige login novo.
- Departamento organiza trabalho. Permissão libera módulo/ação. Alçada autoriza decisão financeira específica. Um não substitui os demais.
- Regras por empresa definem slots de aprovação, autoridade e permissão exigida, com vigência e publicação governada. Aprovação financeira verifica as três dimensões no servidor: empresa, permissão e autoridade vigente.
- Cadastro atual de áreas é catálogo fechado: Diretoria, Operações, Risco e crédito, Controladoria, Financeiro, Comercial e Cadastro. Competência de Diretoria de crédito pode ser atribuída no painel. Não foi entregue editor livre de novos departamentos/autoridades nem teto monetário individual.

## Extensão planejada

1. Catálogo versionado por tenant para departamentos e autoridades, IDs estáveis, nomes editáveis, inativação lógica, autoria/motivo e histórico. Reutilizar IDs atuais; referências antigas permanecem válidas nos snapshots.
2. Departamento pode sugerir pacote inicial de permissões; concessão efetiva continua explícita por usuário. Trocar nome/área nunca concede acesso automaticamente.
3. Atribuição de autoridade por usuário e empresa, início/fim de validade e substituição temporária. Alterações materiais passam pela governança existente; sem autoaprovação por gestores.
4. Política de alçada por empresa com faixas de valor e aprovadores exigidos. Toda avaliação permanece determinística e produz snapshot auditável. Definir antes a base monetária: valor bruto, líquido ou exposição adicional; moeda; combinação de aprovadores; tratamento de limites sobrepostos.
5. Migração aditiva apenas quando essa extensão entrar em implementação. Não renomear/recriar migrações aplicadas nem manter catálogo paralelo no navegador.
6. Aceite: usuário sem departamento, área inativa, múltiplas áreas, herança inicial versus concessão explícita, troca de empresa, autoridade vencida/substituta, faixas adjacentes, arredondamento em centavos, concorrência, revogação em sessão aberta e preservação das decisões anteriores.

Não há pendência para usar o controle atual de módulos/departamentos. Catálogo livre e limites por valor são evolução de produto; não apresentar como funcionalidade existente.
