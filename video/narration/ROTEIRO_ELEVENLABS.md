# Roteiro para gravar no ElevenLabs (site)

Modelo: Eleven Multilingual v2 (ou Eleven v3). Voz masculina, sotaque brasileiro.
Stability ~45% · Similarity ~80% · Style ~25% · Speaker boost ligado · Speed 1.0 · saída MP3.

Tom: institucional, confiante e próximo — um fundador explicando a missão, sem tom de anúncio de rádio.

Gere um arquivo por trecho com o nome indicado e coloque em `public/missao/` (ou envie na conversa).
Se mudar o texto, atualize também `narration/missao.json` (as legendas vêm de lá).
Depois: `python scripts/medir_narracao.py` (mede os MP3), `python scripts/gerar_trilha.py` e `npm run render:missao`.

## 1. narr_abertura.mp3

Todos os dias, factorings, securitizadoras e fundos de recebíveis antecipam o dinheiro que mantém milhares de empresas brasileiras funcionando.

## 2. narr_problema.mp3

Mas, por trás de cada operação, ainda existem planilhas, e-mails, sistemas que não conversam e a mesma informação digitada várias vezes. Cada exceção vira uma corrida. E cada decisão é difícil de explicar depois.

## 3. narr_mercado.mp3

E o mercado está mudando. A duplicata escritural e as novas regras dos fundos exigem processos eletrônicos, rastreáveis e auditáveis. Quem continuar no improviso vai ficar para trás.

## 4. narr_missao.mp3

É por isso que estamos nessa missão. Não para criar mais um sistema cheio de telas, mas uma plataforma que trabalha junto com você. Do recebível ao caixa, com o mínimo de intervenção, e cada decisão explicável.

## 5. narr_entrada.mp3

Você envia o lote: nota fiscal, arquivo bancário ou planilha. O Strato extrai os títulos, valida cada documento e mostra, na hora, o que está pronto e o que falta.

## 6. narr_esteira.mp3

A operação segue numa única área de trabalho, em seis etapas: entrada, risco, lastro, preço, aprovação e liberação. Sem pular de módulo em módulo.

## 7. narr_excecao.mp3

O que está dentro da política anda sozinho. Só as exceções chegam até você, com a regra, o valor observado e uma recomendação. Um clique, e o sistema recalcula tudo.

## 8. narr_copiloto.mp3

E o Copiloto organiza o seu dia, responde perguntas sobre a carteira e explica cada apontamento, em português claro.

## 9. narr_carteira.mp3

Da liberação à cobrança, carteira, caixa e conciliação ficam conectados e atualizados em tempo real.

## 10. narr_trilha.mp3

Cada decisão fica registrada: quem decidiu, quando e com qual política. Pronto para qualquer auditoria.

## 11. narr_fechamento.mp3

Quem move a economia real merece tecnologia à altura. Strato. A plataforma operacional de recebíveis.
