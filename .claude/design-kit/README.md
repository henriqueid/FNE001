# Kit de design premium

Instalado em 27/10/2026 para o agente `design-premium` (comando `/designer`). Tudo é cópia versionada no repositório para funcionar em sessões locais e na nuvem sem instalação adicional.

## Skills em `.claude/skills/`

| Skill | Origem | Commit | Licença |
|---|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | dbd4588 | `LICENSE.txt` da skill |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 12af471 | MIT |
| `high-end-visual-design`, `minimalist-ui`, `industrial-brutalist-ui`, `gpt-taste`, `stitch-design-taste`, `design-taste-frontend-v1`, `design-taste-frontend-v2-experimental` (opt-in, só por nome) | [Leonxlnx/taste-skill-classics](https://github.com/Leonxlnx/taste-skill-classics) | 5e08c93 | MIT |
| `ui-ux-pro-max`, `design-system`, `ui-styling`, `brand`, `banner-design`, `design`, `slides` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 28b3b8d | MIT |
| `web-animation-design` | vercel-labs/open-agents, via [connorads/dotfiles](https://github.com/connorads/dotfiles) | f25d4cf | não declarada no espelho |

Ajuste local: em `ui-ux-pro-max/SKILL.md`, `${CLAUDE_PLUGIN_ROOT}/.claude/skills/` virou `.claude/skills/` (instalação por projeto, não por plugin). Pastas `tests/` dos originais foram omitidas.

## Biblioteca de referência

| Pasta | Origem | Commit | Licença |
|---|---|---|---|
| `animation-principles/` (≈150 guias, consultados sob demanda, não registrados como skills para não lotar o contexto) | [dylantarre/animation-principles](https://github.com/dylantarre/animation-principles) | 8359713 | ver `LICENSE` |
| `awesome-claude-design/` (DESIGN.md por família estética, receitas e prompts) | [rohitg00/awesome-claude-design](https://github.com/rohitg00/awesome-claude-design) | 7f60ee5 | ver `LICENSE` |

## Ferramentas

- `bin/chrome-cloud`: chama o Chromium com `--no-sandbox` para o inspetor do taste-skill em containers como root. Uso: `CHROME_PATH=.claude/design-kit/bin/chrome-cloud node .claude/skills/design-taste-frontend/scripts/inspect.mjs <página>`. Caminho do navegador pode ser forçado com `DESIGN_CHROME`.
- `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --design-system -p "<Projeto>"` gera recomendação de sistema de design.
- `node .claude/skills/design-taste-frontend/scripts/draw.mjs --sector <setor> --brief "<produto>"` sorteia uma direção de arte.

## Bibliotecas de UI/animação (instalar por projeto, sob demanda)

Motion, GSAP + ScrollTrigger, Lenis, Magic UI, Aceternity UI, React Bits, Motion Primitives. Não foram adicionadas ao `package.json`: entram somente quando uma tela as usar, com confirmação.

## Atualizar

Clone os repositórios de origem, revise as diferenças e substitua as pastas correspondentes; reaplique o ajuste do `ui-ux-pro-max`.
