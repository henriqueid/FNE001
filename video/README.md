# Vídeo · Copiloto STRATO (Remotion)

Animação de ~61 s (1920×1080, 30 fps) que apresenta o Copiloto: lançador, abertura do dia, Central do Dia,
consultas, Mesa Inteligente, cenários versionados, governança (IA × motor × pessoa) e trilha de decisão.

Segue o **Visual Ledger (v10)** de `docs/CONVENTIONS.md`: tema claro, tinta preta para ação, cinzas para estrutura,
menta só para destaque positivo, verde/âmbar/vermelho só para estado, fonte Urbanist e sem gradientes ou brilhos.
Tokens em `src/theme.ts` (espelham `app/styles/design-system.css`).

Os números e nomes são fictícios, coerentes com os dados de demonstração (`src/domain/copilot/desk-demo.ts`).

```bash
npm install
npm run studio   # edição ao vivo
npm run render   # gera out/copiloto.mp4
```
