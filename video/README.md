# Vídeo · Copiloto STRATO (Remotion)

Animação de ~63 s (1920×1080, 30 fps) que apresenta o Copiloto: lançador, abertura do dia, Central do Dia,
consultas, Mesa Inteligente, cenários versionados, governança (IA × motor × pessoa) e trilha de decisão.

Usa a identidade do Copiloto v3 "STRATO Intelligence" (`app/styles/ledger.css`): cabeçalho azul-marinho em degradê
com brilhos azul/índigo, avatar branco→azul-claro, lançador marinho e detalhes em degradê `#0f172a → #2563eb`, sobre o
conteúdo claro do Visual Ledger (`app/styles/design-system.css`) e os tons de estado da Central do Dia. Fonte Urbanist.
Tokens em `src/theme.ts`. O vídeo mostra cursor clicando nas ações e uma barra de capítulos no rodapé.

Os números e nomes são fictícios, coerentes com os dados de demonstração (`src/domain/copilot/desk-demo.ts`).

```bash
npm install
npm run studio   # edição ao vivo
npm run render   # gera out/copiloto.mp4
```
