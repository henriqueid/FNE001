# Jornada autenticada no navegador —26/10/2026

Ambiente: build de produção local/vinext, PostgreSQL18 descartável (base restaurada pelo runner), somente dados de teste CHURUME. Hosts locais127.0.0.1 e localhost mantiveram cookies separados para administrador e operador. Sem banco produtivo ou provedor externo. Credenciais temporárias ficaram em fixture privada fora do repositório; não estão neste relatório.

| Caso executado | Resultado | Evidência |
|---|---|---|
| Solicitar usuário pelo formulário público, login/CPF/e-mail sintéticos | Solicitação enviada, sem liberação automática | `evidencias-browser/01-usuario-pendente.png` |
| Entrar antes da liberação | Recusado | `02-login-pendente-negado.png` |
| Administrador define empresa e somente dashboard/consulta operações, ativa e salva | Confirmação do servidor; perfil ativo | `03-acesso-aprovado-restrito.png` |
| Entrar com novo usuário | Identidade CHURUME real; somente Visão geral e Operações no menu | `04-login-operador-menu-restrito.png` |
| Abrir Operações com consulta e sem edição | Lista funcional; criação não oferecida | `05-operacoes-somente-consulta.png` |
| Administrador revoga operations:view e salva; novo login | Menu passa a oferecer somente Visão geral | `06-modulo-revogado.png` |
| Administrador em localhost suspende usuário com sessão127.0.0.1 aberta | Suspensão confirmada; sessão antiga deixa de acessar após recarga | `07-usuario-suspenso.png`, `08-sessao-revogada.png` |
| Entrar novamente enquanto suspenso | Recusado | `09-login-suspenso-negado.png` |
| Reativar pelo administrador e recarregar sessão antiga | Continua na tela de login | `10-reativacao-exige-novo-login.png` |
| Informar credencial e efetuar novo login depois da reativação | Identidade correta; somente permissões restantes | `11-novo-login-apos-reativacao.png` |

## Defeitos encontrados nesta jornada

1. Onboarding: atualização de escopo usava parâmetro sem tipo em jsonb_build_array; SQL500 após gravação parcial da empresa. Reproduzido no PostgreSQL. Correção: cast explícito e transação perfil+escopo; regressão real adicionada.
2. Operador sem settings:view ficava preso no onboarding porque contexto institucional respondia403. Correção: contexto mínimo autenticado sem contatos/endereço administrativos; destinos operacionais filtrados pelas empresas permitidas. Manutenção continua protegida.
3. Operador sem users:manage recebia403 no diretório e a raiz mantinha seed administrativo. APIs financeiras negavam acesso, porém a UI apresentava identidade/módulos errados. Correção: estado inicial real vazio, GET próprio perfil real, falha fechada com recuperação, leituras condicionadas às permissões, reconfirmação em foco/30s e limpeza de projeções após mudança de acesso. Regressão nativa capturada nas evidências04–06.

## Limites da evidência

- A tela de login foi operada manualmente pela automação nativa do navegador; não foi uma reprodução por fetch ou mock.
- Revogação de permissão em cookie já aberto, mudanças de empresa, maker-checker e validade de autoridade também têm testes SQL/handlers; não atribuir a todos eles clique visual nesta jornada. Suspensão com duas sessões foi efetivamente percorrida no navegador.
- Os builds foram reiniciados durante a investigação. O cluster descartável foi retomado após expirar o tempo automático do runner; as evidências posteriores usaram a mesma base de teste, sem tocar conexões existentes de produção.
- Esta jornada não homologa todas combinações de controles, fornecedores, dispositivos, arquivos ou regras de crédito. O relatório consolidado separa essas pendências.

## Complemento CFG04 — build final

Na mesma base descartável, constraint temporária restringiu `contracted=true` somente para a fixture. Pelo navegador, marcar licença levou a500 controlado: checkbox voltou a desmarcado, status “Configuração não confirmada”, aviso humano e controles bloqueados. Removida a constraint, “Tentar novamente” recarregou estado autoritativo: aviso desapareceu e licença permaneceu desmarcada. Nenhuma requisição ao provedor; nenhuma licença real contratada. Evidências12/13. Constraint removida ao concluir a sonda.
