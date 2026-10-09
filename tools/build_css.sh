#!/usr/bin/env bash
# Regenera os tokens claro/escuro a partir de app/styles/legacy.css e commercial.css.
# As cores já tokenizadas (var(--c-...)) são mantidas; só literais novos viram tokens.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/theme_tokens.py app/styles/legacy.css /tmp/legacy.tok.css /tmp/legacy.tokens.css
echo "Revise /tmp/legacy.tok.css antes de substituir app/styles/legacy.css."
