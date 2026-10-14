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

---

# Vídeo · Missão STRATO (16:9 e 9:16)

Vídeo de ~2 min com narração, trilha original e animações de uso do sistema: por que estamos reinventando a operação
de recebíveis e onde o STRATO entra. Duas composições com o mesmo conteúdo: `MissaoStrato16x9` (1920×1080) e
`MissaoStrato9x16` (1080×1920, redes sociais), com legendas embutidas.

- Roteiro e textos da narração: `narration/missao.json` (voz, velocidade e trechos).
- Cenas: `src/missao/` — `scenes-historia.tsx` (abertura, problema, mercado, missão, fechamento) e
  `scenes-produto.tsx` (entrada, esteira, exceção, Copiloto, carteira, trilha). O tempo de cada cena acompanha a
  duração da narração (`src/missao/timing.json`).
- Áudio em `public/missao/`: narração por trecho, trilha e efeitos. A trilha abaixa sozinha durante a fala.

```bash
npm run render:missao          # gera out/missao-strato-16x9.mp4 e out/missao-strato-9x16.mp4
```

Para regravar a narração (por exemplo, ao mudar o texto ou a voz) e recompor a trilha no novo tempo:

```bash
pip install kokoro-onnx soundfile numpy scipy
# baixe kokoro-v1.0.onnx e voices-v1.0.bin de github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)
python scripts/gerar_narracao.py <pasta_do_modelo> [pf_dora|pm_alex|pm_santa]
python scripts/gerar_trilha.py
```

A narração usa o Kokoro (modelo aberto, licença Apache 2.0) e a trilha é composta pelo próprio script, sem samples
de terceiros. Números e nomes de clientes nas telas são fictícios.
