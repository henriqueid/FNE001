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
| Estrutura | Dores riscadas → promessa → logo → módulos → 8 cenas de produto → manifesto → assinatura com CTA |
| Cena de produto | Print real do sistema numa moldura, câmera que enquadra cada área (`camera`), anel de destaque (`marks`), legenda de vidro (rótulo + título curto + apoio) e indicador de etapa no topo |
| Movimento | Uma curva de entrada (`ease.out`), palavras reveladas inteiras (sem máquina de escrever), transições em fade de 0,4 s |

Melhorias em relação à referência: resolução 1080p (antes 1024×576), versão vertical, prints em 2× de densidade, legendas reveladas por palavra, textos de apoio legíveis em celular, indicador de progresso, cena de módulos e chamada final para ação.

Textos da abertura e do fechamento são props das composições em `src/Root.tsx`; roteiro das cenas em `src/StratoPromo.tsx`.

## Prints

`public/screens/` guarda prints do **modo demonstração** (dados fictícios), em coordenadas de tela 1600 × 1000: retângulos de `camera` e `marks` usam essa escala. Para recapturar, rode o app localmente contra um PostgreSQL descartável (com as migrações aplicadas) e execute `node scripts/capture-screens.cjs`. Nunca capture dados reais de clientes.

## STRATO × proScore (vídeo de parceria, ~11 min)

Composição `StratoProScore` (1920×1080, 30 fps) em `src/proscore/`:

| Pasta | Conteúdo |
| --- | --- |
| `data/narration.ts` | Roteiro narrado por cena (uma frase por item = uma legenda) |
| `data/timeline.json` | Duração do áudio e início/fim de cada frase (gerado) |
| `data/timing.json` | Respiros de entrada/saída e transição entre cenas |
| `data/integrationMap.ts` | Mapa módulo × oportunidade × encaixe exibido na cena 08 |
| `components/` | Câmera sobre prints (`ScreenCapture`), legendas, selos de veracidade, relógio da narração |
| `scenes/Scene01…14` | Uma cena por arquivo, animadas a partir dos tempos das frases |

Áudio em `public/proscore/audio/` (narração ElevenLabs `eleven_v4`, voz “Davi Menegon – Calm & Professional”;
trilha ElevenLabs Music instrumental), normalizado a −16 LUFS. Prints em `public/proscore/screens/` e `public/screens/`
(modo demonstração, dados fictícios).

Fluxo para alterar a narração de uma cena:

```bash
node scripts/tts-text.cjs s07            # texto enviado ao TTS (pausas e pronúncias)
# gerar o novo áudio e salvar em public/proscore/audio/s07.mp3 (−16 LUFS)
node scripts/align-captions.cjs          # realinha legendas e durações pelas pausas do áudio
node scripts/export-srt.cjs out/strato-proscore.srt
node scripts/export-script.cjs           # docs/proscore/02-roteiro-final.md
npx remotion render StratoProScore out/strato-proscore.mp4
npx remotion still StratoProScoreThumbnail out/strato-proscore-capa.png
```

Documentação de apoio em `docs/proscore/`: pesquisa pública, roteiro final, mapa de integrações, relatório de
evidências (existente / parcial / planejada / proposta) e score interno e agentes de IA.
