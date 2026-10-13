# Revisão de dependências — 13/10/2026

## Resultado executivo

O `npm audit` completo reporta sete alertas altos, todos derivados de uma única vulnerabilidade em `braces` (CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm). O pacote não possui versão corrigida publicada. A auditoria restrita às dependências de produção retorna zero vulnerabilidades.

O STRATO não aceita padrões glob (`glob`) enviados por usuários. A cadeia afetada é usada por ferramentas de lint e compilação para localizar arquivos do próprio repositório. Portanto, o cenário descrito pelo aviso — padrão de chaves profundamente aninhado controlado por atacante — não está exposto nas rotas HTTP da aplicação.

## Parecer individual

| Pacote | Origem | Uso no STRATO | Parecer e tratamento |
| --- | --- | --- | --- |
| `braces@3.0.3` | Transitivo | Expansão de padrões durante lint/build | Vulnerabilidade real de indisponibilidade por recursão sem limite. Não há versão corrigida. Risco externo mitigado porque nenhum padrão vem de requisição ou dado cadastrado. Monitorar publicação oficial. |
| `micromatch@4.0.8` | Transitivo de `fast-glob` | Correspondência de arquivos no build | Não possui falha independente neste relatório; apenas propaga `braces`. Está na versão mais recente disponível. |
| `fast-glob@3.3.1/3.3.3` | Transitivo | Busca de arquivos no lint e plugins do Vite | Não possui falha independente; propaga `micromatch`. O caminho do Vite já usa a versão mais recente. |
| `@next/eslint-plugin-next@16.4.0` | Direto de desenvolvimento | Regras de qualidade do código | Atualizado de 16.2.6 para 16.4.0. O downgrade sugerido pelo npm para 14.2.35 foi rejeitado por incompatibilidade e por não corrigir a causa raiz de forma sustentável. |
| `vite-plugin-dynamic-import@1.6.0` | Transitivo do `vinext` | Transformação durante compilação | Versão mais recente disponível. Não processa entradas de usuários em produção. |
| `vite-plugin-commonjs@0.10.4` | Transitivo do `vinext` | Compatibilidade de módulos durante compilação | Versão mais recente disponível. O alerta é herdado de `vite-plugin-dynamic-import`. |
| `vinext@1.1.0` | Direto de desenvolvimento/servidor | Build e runtime compatível com Next/Vite | Versão mais recente disponível. O downgrade sugerido para 0.0.15 quebraria a aplicação. A inicialização de produção passou a importar diretamente `vinext/server/prod-server`, evitando carregar o CLI e o pipeline de build no processo web. |

## Controles aplicados

1. Dependências diretas permanecem fixadas no `package-lock.json`.
2. `npm run audit:production` bloqueia alertas altos nas dependências classificadas para produção.
3. `npm run audit:full` mantém visibilidade do alerta de build ainda sem correção upstream.
4. O processo web usa um inicializador mínimo e não executa glob, lint ou compilação ao atender requisições.
5. Não foi usado `npm audit fix --force`, pois ele substituiria componentes atuais por versões antigas e incompatíveis.

## Critério para encerramento definitivo

Assim que `braces` publicar uma versão corrigida — ou `fast-glob`/`vinext` removerem essa cadeia — atualizar o lockfile, executar as duas auditorias, a suíte completa e o build antes da implantação.
