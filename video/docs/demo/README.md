# Vídeo demonstrativo — operação de ponta a ponta (4:5)

Composição Remotion `StratoOperacaoDemo` · 1080 × 1350 · 30 fps · H.264 · 36 s · sem áudio · legendas na tela.

## Renderizar novamente

```bash
# 1) (opcional) recapturar as telas do STRATO real em modo demonstração local
#    pré-requisito: app em http://127.0.0.1:5173 (npx vite dev) com o PostgreSQL local de teste
node video/scripts/demo/capture-operation.cjs

# 2) renderizar o MP4 e extrair a capa
cd video
npx remotion render StratoOperacaoDemo out/strato-operacao-demo-4x5.mp4 --codec=h264 --crf=18
ffmpeg -ss 25.6 -i out/strato-operacao-demo-4x5.mp4 -frames:v 1 out/strato-operacao-demo-capa.png
```

## O que é do sistema e o que é simulado

**Reaproveitado do STRATO (telas reais, execução local em modo demonstração):**
- Copiloto operacional com o arquivo CSV fictício anexado, leitura offline e registro das etapas da análise.
- Operação criada pelo Copiloto na esteira (Entrada → Risco → Lastro → Preço → Aprovação → Liberação), motor de elegibilidade, análise do cedente e dos sacados.
- Preço calculado pelo motor do sistema: face R$ 120.000,00, deságio R$ 3.456,06, tarifas R$ 144,00, líquido R$ 116.399,94, prazo médio de 35 dias.
- Aprovação e formalização: botão “Aprovar operação”, alçadas, pacote de documentos e registro manual das assinaturas.
- Liberação ao financeiro e baixa do pagamento no livro local da demonstração; carteira por cedente e trilha da decisão.
- Identidade visual: logotipo, fonte Urbanist e tokens de cor de `app/globals.css`.

**Simulado / fictício:**
- Todos os dados: cedente “Empresa Exemplo Ltda”, sacados, títulos, chaves NF-e e conta bancária (`video/scripts/demo/operacao-empresa-exemplo.csv`).
- Consulta ao birô de demonstração, alçadas e assinaturas registradas pelo mesmo usuário de demonstração.
- Pagamento: apenas registro no livro local; nenhuma transmissão bancária.
- As duas mensagens do Copiloto em destaque (cenas 2 e 5) são textos do roteiro, desenhados no estilo do painel.
- Cartões de destaque (verificações, pontuação, resumo financeiro, status) são sobreposições do vídeo com os valores do sistema.
- A pontuação exibida (886/1000) é o índice interno do sistema para este cadastro fictício; é ilustrativa, não é probabilidade de pagamento.
