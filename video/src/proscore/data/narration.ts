// Roteiro final narrado do vídeo STRATO × proScore. Cada parágrafo é uma frase/legenda.
// Cenas 01–10 seguem o roteiro mestre (versão completa); cenas 11–14 seguem a continuação do roteiro.
// A última frase da cena 10 chegou truncada e foi completada ("…para o funcionamento da plataforma").

export type SceneNarration = {
  id: string;
  title: string;
  sentences: string[];
};

export const NARRATION: SceneNarration[] = [
  {
    id: "s01",
    title: "A oportunidade",
    sentences: [
      "O mercado de crédito e recebíveis evoluiu muito nos últimos anos.",
      "As operações ficaram mais dinâmicas, as exigências de controle aumentaram e o acesso à informação se tornou cada vez mais importante.",
      "Mas existe um desafio que continua presente em muitas estruturas financeiras: a tecnologia ainda exige esforço demais de quem precisa operar.",
      "São diferentes telas, processos manuais, consultas isoladas e informações que nem sempre se conectam no momento da decisão.",
      "Foi observando essa realidade que começamos a construir o STRATO.",
    ],
  },
  {
    id: "s02",
    title: "Nossa visão",
    sentences: [
      "O STRATO nasce com um direcionamento claro: tornar a gestão de operações financeiras mais inteligente, mais conectada e menos complexa.",
      "Queremos entregar tecnologia de alto nível sem reproduzir toda a complexidade de utilização que costuma acompanhar sistemas desse segmento.",
      "Nossa proposta não é retirar recursos ou simplificar controles essenciais.",
      "É simplificar o caminho que o usuário percorre para executar o seu trabalho.",
      "Para nós, a sofisticação precisa estar na engenharia da solução, não na dificuldade de utilizá-la.",
    ],
  },
  {
    id: "s03",
    title: "A plataforma",
    sentences: [
      "O STRATO está sendo desenvolvido para conectar o ciclo completo de uma operação de recebíveis.",
      "O processo começa no relacionamento com cedentes e sacados, passa pela análise de crédito, recepção e validação de títulos, aplicação de políticas operacionais, aprovação e formalização.",
      "Depois do desembolso, a operação continua sendo acompanhada por processos de gestão de carteira, conciliação, cobrança, recompra e encerramento.",
      "Tudo isso sustentado por registros históricos, regras de negócio e mecanismos de auditoria.",
      "Nossa visão é reunir, em uma mesma plataforma, as atividades que hoje frequentemente dependem de diferentes ferramentas e intervenções humanas.",
    ],
  },
  {
    id: "s04",
    title: "Automação orientada a eventos",
    sentences: [
      "Um dos pilares do STRATO é a automação operacional.",
      "Queremos que o sistema deixe de ser apenas um lugar onde o operador registra o que fez e passe a ser uma plataforma capaz de conduzir atividades recorrentes conforme regras previamente estabelecidas.",
      "Imagine uma remessa de recebíveis chegando ao sistema.",
      "Os dados são validados, as políticas aplicadas, os limites verificados e as divergências identificadas.",
      "Aquilo que atende às condições operacionais pode seguir o fluxo configurado, respeitando as alçadas necessárias.",
      "O que exige análise adicional é direcionado para uma fila de exceções.",
      "A proposta é simples: reduzir a quantidade de trabalho repetitivo e direcionar o profissional para aquilo que realmente exige julgamento.",
    ],
  },
  {
    id: "s05",
    title: "O motor de decisão",
    sentences: [
      "Por trás dessa dinâmica existe uma decisão arquitetural fundamental.",
      "As regras financeiras objetivas não podem depender de uma interpretação probabilística.",
      "No STRATO, cálculos, critérios de elegibilidade, limites, aprovações e movimentações financeiras seguem motores determinísticos e políticas configuradas.",
      "Cada decisão precisa ter origem, justificativa, histórico e rastreabilidade.",
      "A inteligência artificial amplia a capacidade de interpretação, mas não substitui a governança do processo financeiro.",
      "Isso permite que o STRATO mantenha seu funcionamento operacional mesmo sem a utilização do Copiloto de IA.",
    ],
  },
  {
    id: "s06",
    title: "O score interno da carteira",
    sentences: [
      "Outro elemento central da nossa estratégia é a inteligência sobre o comportamento da própria carteira.",
      "O STRATO busca transformar os dados gerados pela operação em informação útil para decisões futuras.",
      "Não queremos observar apenas se um título foi pago ou não.",
      "Queremos analisar a recorrência de atrasos, o comportamento dos sacados, a evolução da exposição, os padrões de liquidação e o histórico operacional dos cedentes.",
      "A partir dessas informações, trabalhamos com uma camada interna de classificação e pontuação da carteira.",
      "Ela permite identificar alterações comportamentais e apoiar a revisão das condições de risco.",
      "Esse índice já prevê componentes externos, como score de bureau e protestos, que hoje aguardam um provedor de dados.",
      "E aqui surge uma das oportunidades mais interessantes de integração com a proScore.",
    ],
  },
  {
    id: "s07",
    title: "A complementaridade com a proScore",
    sentences: [
      "A proScore possui uma atuação consolidada em inteligência de dados, análise de crédito, score, prevenção à fraude, compliance e soluções de decisão.",
      "O STRATO, por sua vez, está sendo concebido como a camada operacional em que muitas dessas informações podem gerar ações práticas.",
      "É nessa complementaridade que enxergamos uma possível sinergia.",
      "De um lado, a capacidade de enriquecer e qualificar informações externas.",
      "Do outro, uma plataforma que conhece o contexto da operação, as políticas de cada cliente, seu histórico e suas necessidades de execução.",
      "A oportunidade não está apenas em integrar consultas.",
      "Está em conectar informação, decisão e operação.",
    ],
  },
  {
    id: "s08",
    title: "Mapa de integrações",
    sentences: [
      "Enxergamos oportunidades de integração em diferentes momentos da jornada financeira.",
      "No cadastro de cedentes e sacados, a proScore poderia apoiar a validação e o enriquecimento cadastral, trazendo informações de identificação, situação das empresas, vínculos e dados relevantes para análise.",
      "Na camada de compliance, poderíamos incorporar verificações relacionadas a pessoas politicamente expostas, grupos econômicos, relacionamentos societários e demais fatores de risco disponíveis.",
      "No crédito, informações de score, restrições, protestos e indicadores externos poderiam alimentar a análise conduzida pelo STRATO, respeitando a política de cada estrutura.",
      "Nas operações, esses dados poderiam contribuir para identificar situações que merecem revisão antes da formalização.",
      "Na carteira, consultas e mecanismos de monitoramento poderiam ajudar a identificar mudanças no perfil de risco.",
      "Na cobrança, informações atualizadas poderiam apoiar a localização, a segmentação e a priorização das ações.",
      "E, em uma camada comercial, recursos de inteligência de mercado poderiam contribuir para a identificação de empresas com potencial de relacionamento.",
      "Cada integração precisaria ser validada técnica e comercialmente, considerando disponibilidade, finalidade, custo e regras de utilização dos dados.",
    ],
  },
  {
    id: "s09",
    title: "O Copiloto de inteligência artificial",
    sentences: [
      "Além da automação, estamos construindo uma experiência assistida por inteligência artificial.",
      "O Copiloto do STRATO foi pensado para aproximar o usuário das informações e dos processos da própria operação.",
      "Em vez de depender exclusivamente da navegação por relatórios e diferentes telas, o profissional pode interagir com a plataforma em linguagem natural.",
      "A proposta é que o Copiloto consiga interpretar solicitações, recuperar informações autorizadas, explicar indicadores e identificar situações que merecem atenção.",
      "Também poderá apoiar a investigação de exceções, organizar prioridades, preparar ações e orientar o usuário durante os processos.",
      "No futuro, sínteses de inteligência externa poderiam entrar como evidência citada, sem que a decisão saia das regras do STRATO.",
      "Mas existe uma característica importante: o Copiloto não precisa decidir sozinho.",
      "Ele deve respeitar as regras do sistema, identificar a origem dos dados e solicitar a aprovação humana sempre que a atividade exigir.",
    ],
  },
  {
    id: "s10",
    title: "As camadas de inteligência",
    sentences: [
      "Nossa arquitetura busca organizar a inteligência em diferentes camadas.",
      "Na base estão os dados operacionais: clientes, sacados, títulos, pagamentos, atrasos, negociações e histórico financeiro.",
      "Sobre esses registros, criamos a memória factual da operação e os indicadores comportamentais.",
      "As integrações externas podem acrescentar informações cadastrais, creditícias e sinais de risco.",
      "Os motores determinísticos aplicam regras e critérios objetivos.",
      "A inteligência artificial conecta contexto, interpreta informações e apoia a tomada de decisão.",
      "Por fim, as ações são executadas dentro dos fluxos autorizados, com registros de origem, responsabilidade e auditoria.",
      "É assim que pretendemos combinar automação, inteligência e controle sem transformar a IA em um componente obrigatório para o funcionamento da plataforma.",
    ],
  },
  {
    id: "s11",
    title: "Exemplo de uma operação inteligente",
    sentences: [
      "Para visualizar essa proposta, podemos imaginar uma situação prática.",
      "Uma securitizadora recebe uma nova operação contendo dezenas de recebíveis.",
      "O STRATO identifica os títulos, aplica as regras de elegibilidade e verifica a exposição da carteira.",
      "Durante o processamento, uma condição previamente configurada exige uma análise complementar.",
      "Nesse momento, uma eventual integração com a proScore poderia fornecer informações adicionais para apoiar a avaliação.",
      "O STRATO relacionaria esses dados ao histórico interno, respeitando as regras e políticas definidas pela instituição.",
      "O Copiloto poderia organizar as informações, explicar os pontos de atenção e preparar uma recomendação.",
      "O analista teria condições de decidir com maior contexto, sem precisar reconstruir manualmente toda a investigação.",
      "É essa experiência operacional conectada que queremos desenvolver.",
    ],
  },
  {
    id: "s12",
    title: "Nosso posicionamento no mercado",
    sentences: [
      "Estamos construindo o STRATO para competir em um mercado que exige profundidade funcional, segurança e confiabilidade.",
      "Sabemos que existem soluções consolidadas e que o nível de exigência desse segmento é elevado.",
      "Nossa proposta é entrar nesse mercado com uma abordagem diferente.",
      "Queremos combinar tecnologia moderna, automação e inteligência com uma experiência operacional mais simples.",
      "Não buscamos competir apenas por preço ou pela quantidade de funcionalidades disponíveis.",
      "Queremos competir pela capacidade de fazer uma operação trabalhar melhor.",
      "Acreditamos que uma boa plataforma financeira deve conseguir crescer em complexidade técnica sem transferir esse peso integralmente ao usuário.",
    ],
  },
  {
    id: "s13",
    title: "Possibilidades de parceria",
    sentences: [
      "É por isso que gostaríamos de aprofundar uma conversa com a proScore.",
      "A primeira oportunidade é tecnológica: compreender quais informações, serviços e APIs poderiam complementar os fluxos do STRATO.",
      "A segunda é operacional: estudar casos de uso nos quais a combinação dos nossos dados e processos possa gerar ganhos mensuráveis de eficiência e qualidade de análise.",
      "E a terceira é comercial: avaliar, no futuro, se existe espaço para uma proposta de valor conjunta voltada a empresas do mercado de recebíveis.",
      "Não estamos apresentando um modelo fechado.",
      "Estamos compartilhando uma visão e convidando a proScore a contribuir com sua experiência para descobrir onde essa complementaridade realmente faz sentido.",
      "Como próximo passo, propomos uma conversa técnica para mapear os serviços e APIs disponíveis e escolher um caso piloto, como a consulta de um sacado novo na entrada da operação.",
    ],
  },
  {
    id: "s14",
    title: "Encerramento",
    sentences: [
      "O STRATO está nascendo de uma convicção: a tecnologia financeira pode ser sofisticada sem ser complicada.",
      "Queremos construir uma plataforma que conecte operações, inteligência e decisões de uma forma verdadeiramente útil para o mercado.",
      "E acreditamos que boas parcerias podem ampliar muito essa capacidade.",
      "Obrigado pela oportunidade de compartilhar um pouco da nossa visão.",
      "Será um prazer explorar com vocês os próximos passos dessa conversa.",
    ],
  },
];
