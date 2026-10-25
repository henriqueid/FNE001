# STRATO · vídeos (Remotion)

Projeto isolado do aplicativo (dependências próprias, fora do `tsconfig`/ESLint da raiz).

```bash
cd video
npm ci
npm run dev                                        # Remotion Studio (pré-visualização)
npx remotion render StratoPromo out/strato-promo.mp4          # 1920×1080
npx remotion render StratoPromoVertical out/strato-vertical.mp4 # 1080×1920 (Reels/Stories)
npx remotion still StratoThumbnail out/capa.png
```

## Padrão visual

Derivado do vídeo de referência de 13/10/2026 e revisado:

| Elemento | Regra |
| --- | --- |
| Fundo | Navy profundo, brilho azul no canto superior que deriva devagar, grade técnica discreta (`components/Background.tsx`) |
| Tipografia | Urbanist (mesma do app); títulos 700–800, dores e apoio 300–500 |
| Cores | `src/brand/tokens.ts`: azul de destaque, verde só para "decide"/aprovação, vermelho para risco/riscado |
| Estrutura | Dores riscadas → promessa → logo → 7 cenas de produto → manifesto → assinatura com CTA |
| Cena de produto | Janela do app nítida sobre o app desfocado, câmera que aproxima do foco, anel de destaque, legenda de vidro (rótulo + título curto + apoio), indicador de etapa no topo |
| Movimento | Uma curva de entrada (`ease.out`), palavras reveladas inteiras (sem máquina de escrever), transições em fade de 0,4 s |

Melhorias em relação à referência: resolução 1080p (antes 1024×576), versão vertical, interface desenhada em vetor (nítida e editável), textos de apoio legíveis em celular, indicador de progresso e chamada final para ação.

Textos editáveis pelas props das composições em `src/Root.tsx`; telas em `src/ui/screens.tsx`.
