# Vídeo demonstrativo — operação de ponta a ponta (4:5)

Composições Remotion · 1080 × 1350 · 30 fps · H.264 · legendas na tela:
- `StratoOperacaoDemoV2` (versão 2, recomendada): 30 s, gancho de abertura, aproximações nos números das telas reais, pausas na aprovação e no pagamento e trilha discreta (trecho da trilha própria do vídeo proScore, `public/demo/music.mp3`).
- `StratoOperacaoDemo` (versão 1): 36 s, sem áudio.

## Renderizar novamente

```bash
# 1) (opcional) recapturar as telas do STRATO real em modo demonstração local
#    pré-requisito: app em http://127.0.0.1:5173 (npx vite dev) com o PostgreSQL local de teste
node video/scripts/demo/capture-operation.cjs

# 2) renderizar o MP4 e extrair a capa
cd video
npx remotion render StratoOperacaoDemoV2 out/strato-operacao-demo-4x5-v2-raw.mp4 --codec=h264 --crf=18
ffmpeg -i out/strato-operacao-demo-4x5-v2-raw.mp4 -c:v copy -af loudnorm=I=-16:TP=-1.5 -ar 48000 -c:a aac -b:a 160k -movflags +faststart out/strato-operacao-demo-4x5-v2.mp4
ffmpeg -ss 1.85 -i out/strato-operacao-demo-4x5-v2.mp4 -frames:v 1 out/strato-operacao-demo-v2-capa.png
```

## O que é do sistema e o que é simulado

**Reaproveitado do STRATO (telas reais, execução local em modo demonstração):**
- Copiloto operacional com o arquivo CSV fictício anexado, leitura offline e registro das etapas da análise.
- Operação criada pelo Copiloto na esteira (Entrada → Risco → Lastro → Preço → Aprovação → Liberação), motor de elegibilidade, análise do cedente e dos sacados.
- Preço calculado pelo motor do sistema: face R$ 120.000,00, deságio R$ 3.456,06, tarifas R$ 144,00, líquido R$ 116.399,94, prazo médio de 35 dias.
- Aprovação e formalização: botão “Aprovar operação”, alçadas, pacote de documentos e registro manual das assinaturas.
- Liberação ao financeiro e baixa do pagamento no livro local da demonstração; carteira por cedente e trilha da decisão.
- Telas capturadas em 3× para aproximações nítidas.
- Identidade visual: logotipo, fonte Urbanist e tokens de cor de `app/globals.css`.

**Simulado / fictício:**
- Todos os dados: cedente “Empresa Exemplo Ltda”, sacados, títulos, chaves NF-e e conta bancária (`video/scripts/demo/operacao-empresa-exemplo.csv`).
- Consulta ao birô de demonstração, alçadas e assinaturas registradas pelo mesmo usuário de demonstração.
- Pagamento: apenas registro no livro local; nenhuma transmissão bancária.
- As duas mensagens do Copiloto em destaque (cenas 2 e 5) são textos do roteiro, desenhados no estilo do painel.
- Cartões de destaque (verificações, pontuação, resumo financeiro, status) são sobreposições do vídeo com os valores do sistema.
- A pontuação exibida (886/1000) é o índice interno do sistema para este cadastro fictício; é ilustrativa, não é probabilidade de pagamento.
