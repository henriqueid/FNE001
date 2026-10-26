// Roteiro final narrado do vídeo STRATO × Financia (docs/financia/01-roteiro-proposta.md).
// Cada item de `sentences` é uma frase/legenda.

export type SceneNarration = {
  id: string;
  title: string;
  sentences: string[];
};

export const NARRATION: SceneNarration[] = [
  {
    id: "f01",
    title: "Abertura",
    sentences: [
      "O mercado de crédito estruturado está mudando.",
      "As operações ficaram mais rápidas, mais reguladas e mais dependentes de dados.",
      "Na STRATO, estamos construindo a plataforma que essa nova operação exige.",
      "E estamos buscando parceiros para chegar lá mais rápido.",
    ],
  },
  {
    id: "f02",
    title: "O problema",
    sentences: [
      "Quem opera FIDC e securitização conhece o esforço do dia a dia.",
      "Cadastro, análise, lastro, formalização, liberação, carteira, cobrança e conciliação.",
      "Grande parte disso ainda depende de sistemas que não conversam, planilhas paralelas e conferência manual.",
      "É tempo da equipe gasto em tarefa repetitiva e decisão tomada sem a visão completa da carteira.",
    ],
  },
  {
    id: "f03",
    title: "O que é o STRATO",
    sentences: [
      "O STRATO reúne a operação inteira em uma única plataforma, do cadastro ao encerramento.",
      "Cada operação percorre etapas definidas.",
      "As políticas de crédito rodam em um motor determinístico, com versão e trilha de auditoria.",
      "E as exceções chegam para quem decide, com o contexto pronto.",
      "Carteira, cobrança e financeiro ficam no mesmo lugar.",
      "E um Copiloto de inteligência artificial ajuda a encontrar a informação, sem decidir no lugar de ninguém.",
    ],
  },
  {
    id: "f04",
    title: "Onde estamos",
    sentences: [
      "A base está construída e funcionando: cadastros, operações, motor de políticas, carteira, financeiro, controladoria e Copiloto.",
      "O que falta é o que só se resolve dentro de uma operação real.",
      "Homologar as rotinas com quem opera todos os dias e validar integrações bancárias e de dados.",
      "Concluir módulos como encerramento e substituição de títulos.",
      "E ajustar cada fluxo à forma como uma estrutura de verdade trabalha.",
    ],
  },
  {
    id: "f05",
    title: "Ecossistema de parceiros",
    sentences: [
      "Nossa estratégia é crescer em ecossistema.",
      "Estamos buscando parcerias com empresas de referência em cada etapa da operação.",
      "Dados e crédito, com a proScore.",
      "Formalização e assinatura, com a Flixsign.",
      "E outros players de infraestrutura do mercado.",
      "No centro disso, estruturas que operam FIDC e securitização no dia a dia.",
      "Com os parceiros certos, nosso objetivo é ambicioso: levar o STRATO a ser a plataforma número um do mercado de recebíveis em pouco tempo.",
    ],
  },
  {
    id: "f06",
    title: "Por que a Financia",
    sentences: [
      "E é aqui que entra a Financia.",
      "Entendemos a Financia como parceira estratégica.",
      "Já estivemos dentro da operação de vocês e sabemos que é uma equipe experiente, que pode agregar muito ao nosso produto.",
      "Buscamos parceiros como vocês por três motivos.",
      "A expertise de quem conhece a operação por dentro.",
      "A referência de mercado que vocês já são.",
      "E a visão comercial para levar o produto a outras estruturas.",
      "Vocês também têm parceiros estratégicos que fazem muito sentido para o nosso ecossistema.",
      "Nenhum ambiente de teste substitui isso.",
    ],
  },
  {
    id: "f07",
    title: "Três fases",
    sentences: [
      "A proposta tem três fases.",
      "Fase um: homologação conjunta.",
      "Durante cerca de noventa dias, a Financia usa o STRATO com licença gratuita e acesso completo a todo o sistema, a qualquer momento, até chegarmos a uma homologação perfeita.",
      "Tudo em paralelo à rotina atual, sem substituir o que já funciona.",
      "A equipe aponta o que precisa mudar; nós ajustamos e concluímos a construção.",
      "Fase dois: piloto de implantação.",
      "Validado, o STRATO entra em produção, com acompanhamento próximo e indicadores claros de tempo, retrabalho e controle.",
      "Fase três: escala.",
      "Com o piloto rodando, a Financia se torna nosso caso de referência.",
      "E sua experiência e influência ajudam a levar o STRATO a outras estruturas.",
    ],
  },
  {
    id: "f08",
    title: "Dois caminhos",
    sentences: [
      "Ao final da jornada, existem dois caminhos.",
      "O primeiro é se tornar sócio, investindo e participando do negócio que ajudou a construir.",
      "Participação e valores ficam para uma conversa em um segundo momento.",
      "O segundo é seguir como cliente piloto.",
      "Nesse caso, a Financia fica isenta de qualquer custo de uso do STRATO, por todo o tempo.",
      "Para sempre.",
      "A decisão vem depois de ver o sistema funcionando na própria operação.",
    ],
  },
  {
    id: "f09",
    title: "O que cada lado oferece",
    sentences: [
      "Do nosso lado: o sistema adaptado à operação, implantação, treinamento e suporte.",
      "Licença gratuita durante a homologação e prioridade nas melhorias que a equipe pedir.",
      "Do lado da Financia: o ambiente e a equipe operacional, casos reais para validação e feedback estruturado.",
      "E, depois de validado, a referência e o apoio comercial.",
    ],
  },
  {
    id: "f10",
    title: "Cuidado com a operação",
    sentences: [
      "Tudo com cuidado com a operação.",
      "Acordo de confidencialidade, dados protegidos e restritos a quem precisa.",
      "Trilha de auditoria completa e nenhuma movimentação com efeito real sem a aprovação da equipe.",
    ],
  },
  {
    id: "f11",
    title: "Próximo passo",
    sentences: [
      "Se essa visão fizer sentido para vocês, o próximo passo é uma conversa.",
      "Para definirmos o escopo da primeira fase, as pessoas envolvidas e os critérios de sucesso.",
      "Será um prazer construir isso juntos.",
    ],
  },
];
