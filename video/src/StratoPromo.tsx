import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, useVideoConfig } from "remotion";
import "./brand/fonts";
import { fontFamily, timing } from "./brand/tokens";
import { EndCard } from "./scenes/EndCard";
import { Hook } from "./scenes/Hook";
import { LogoReveal } from "./scenes/LogoReveal";
import { Manifesto } from "./scenes/Manifesto";
import { ProductScene } from "./scenes/ProductScene";
import {
  ApprovalScreen,
  AskScreen,
  BatchScreen,
  CollectionScreen,
  DayOpeningScreen,
  DuplicateScreen,
  PipelineScreen,
} from "./ui/screens";

export type StratoPromoProps = {
  pains: string[];
  answer: string;
  answerAccent: string;
  cta: string;
  contact: string;
};

// Durações das cenas em segundos, na ordem do vídeo.
export const SCENE_SECONDS = [5.8, 2.8, 5.6, 5.0, 5.6, 5.6, 5.0, 5.2, 5.0, 4.2, 4.6];

export const totalFrames = (fps: number) =>
  Math.round(SCENE_SECONDS.reduce((a, b) => a + b, 0) * fps) -
  (SCENE_SECONDS.length - 1) * Math.round(timing.crossfade * fps);

const CHAPTERS = 7;

export const StratoPromo: React.FC<StratoPromoProps> = ({ pains, answer, answerAccent, cta, contact }) => {
  const { fps } = useVideoConfig();
  const s = (i: number) => Math.round(SCENE_SECONDS[i] * fps);
  const cut = () => (
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: Math.round(timing.crossfade * fps) })} />
  );

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Abertura" durationInFrames={s(0)}>
          <Hook pains={pains} answer={answer} answerAccent={answerAccent} />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Logo" durationInFrames={s(1)}>
          <LogoReveal tagline="A plataforma operacional da antecipação de recebíveis" />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Abertura do dia" durationInFrames={s(2)}>
          <ProductScene
            chapter={0}
            totalChapters={CHAPTERS}
            chapterLabel="Visão do negócio"
            windowTitle="Visão geral"
            focus={[568, 250]}
            eyebrow="Abertura do dia"
            title="Seu negócio inteiro, numa tela."
            body="Prioridades, carteira, vencidos e meta antes do primeiro café."
          >
            <DayOpeningScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Esteira" durationInFrames={s(3)}>
          <ProductScene
            chapter={1}
            totalChapters={CHAPTERS}
            chapterLabel="Operação"
            windowTitle="Operações"
            focus={[568, 300]}
            eyebrow="Operações"
            title="Da entrada à liberação, em 6 etapas."
            body="Entrada · Risco · Lastro · Preço · Aprovação · Liberação."
          >
            <PipelineScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Lote" durationInFrames={s(4)}>
          <ProductScene
            chapter={2}
            totalChapters={CHAPTERS}
            chapterLabel="Integração"
            windowTitle="Copiloto"
            focus={[800, 340]}
            eyebrow="Copiloto · lote"
            title="Mande o lote. Ele faz a conferência."
            body="XML de NF-e, CNAB ou planilha: tudo entra no mesmo fluxo."
          >
            <BatchScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Decisão humana" durationInFrames={s(5)}>
          <ProductScene
            chapter={3}
            totalChapters={CHAPTERS}
            chapterLabel="Controle"
            windowTitle="Copiloto"
            focus={[860, 300]}
            eyebrow="Decisão humana"
            title="Nada acontece sem você."
            body="Consulta ao birô só com a sua autorização."
          >
            <ApprovalScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Duplicata" durationInFrames={s(6)}>
          <ProductScene
            chapter={4}
            totalChapters={CHAPTERS}
            chapterLabel="Risco"
            windowTitle="Análise da operação"
            focus={[568, 140]}
            eyebrow="Análise completa"
            title="Achou a duplicata antes de você."
            body="A NF já estava na carteira: a aprovação fica bloqueada."
          >
            <DuplicateScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Pergunte" durationInFrames={s(7)}>
          <ProductScene
            chapter={5}
            totalChapters={CHAPTERS}
            chapterLabel="Visibilidade"
            windowTitle="Copiloto"
            focus={[300, 420]}
            eyebrow="Pergunte ao Copiloto"
            title="Pergunte. A resposta vem com a fonte."
            body="Dados da sua carteira, sem planilha paralela."
          >
            <AskScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Cobrança" durationInFrames={s(8)}>
          <ProductScene
            chapter={6}
            totalChapters={CHAPTERS}
            chapterLabel="Carteira"
            windowTitle="Carteira"
            focus={[568, 300]}
            eyebrow="Carteira e cobrança"
            title="Quem cobrar hoje, e em que ordem."
            body="Fila priorizada pelo risco, com a régua aplicada a cada título."
          >
            <CollectionScreen />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Manifesto" durationInFrames={s(9)}>
          <Manifesto footnote="Cálculos e alçadas continuam determinísticos. Cada passo fica registrado." />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Assinatura" durationInFrames={s(10)}>
          <EndCard segments="FACTORING · FIDC · SECURITIZADORA · ESC" cta={cta} contact={contact} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
