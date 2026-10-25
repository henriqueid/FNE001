import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, useVideoConfig } from "remotion";
import "./brand/fonts";
import { colors, fontFamily, timing } from "./brand/tokens";
import { Cursor } from "./components/Cursor";
import { EndCard } from "./scenes/EndCard";
import { Hook } from "./scenes/Hook";
import { LogoReveal } from "./scenes/LogoReveal";
import { Manifesto } from "./scenes/Manifesto";
import { Modules } from "./scenes/Modules";
import { ProductScene } from "./scenes/ProductScene";

export type StratoPromoProps = {
  pains: string[];
  answer: string;
  answerAccent: string;
  slogan: string;
  sloganAccent: string;
  cta: string;
  contact: string;
};

// Durações das cenas em segundos, na ordem do vídeo.
export const SCENE_SECONDS = [6.0, 2.8, 4.4, 5.8, 5.4, 4.8, 5.4, 5.0, 6.2, 4.8, 4.8, 4.2, 4.6];

export const totalFrames = (fps: number) =>
  Math.round(SCENE_SECONDS.reduce((a, b) => a + b, 0) * fps) -
  (SCENE_SECONDS.length - 1) * Math.round(timing.crossfade * fps);

const CHAPTERS = 8;
const FULL: [number, number, number, number] = [0, 0, 1600, 1000];

export const StratoPromo: React.FC<StratoPromoProps> = ({
  pains,
  answer,
  answerAccent,
  slogan,
  sloganAccent,
  cta,
  contact,
}) => {
  const { fps } = useVideoConfig();
  const s = (i: number) => Math.round(SCENE_SECONDS[i] * fps);
  const cut = () => (
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: Math.round(timing.crossfade * fps) })} />
  );

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Dores" durationInFrames={s(0)}>
          <Hook pains={pains} answer={answer} answerAccent={answerAccent} />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Logo" durationInFrames={s(1)}>
          <LogoReveal tagline="A plataforma operacional da antecipação de recebíveis" />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Módulos" durationInFrames={s(2)}>
          <Modules title="Tudo o que estava espalhado," accent="agora num só lugar." />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Abertura do dia" durationInFrames={s(3)}>
          <ProductScene
            chapter={0}
            totalChapters={CHAPTERS}
            chapterLabel="Seu dia"
            images={[{ src: "screens/abertura-do-dia.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [300, 70, 1000, 625] },
              { at: 3.0, rect: [300, 330, 1000, 625] },
            ]}
            marks={[
              { at: 1.4, end: 2.9, rect: [336, 374, 928, 88] },
              { at: 3.6, rect: [336, 478, 602, 446] },
            ]}
            eyebrow="Abertura do dia"
            title="Seu dia começa com contexto."
            body="Prioridades, carteira, vencidos e meta antes do primeiro café."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Visão geral" durationInFrames={s(4)}>
          <ProductScene
            chapter={1}
            totalChapters={CHAPTERS}
            chapterLabel="Visão do negócio"
            images={[{ src: "screens/visao-geral.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [0, 250, 1260, 788] },
            ]}
            marks={[
              { at: 1.4, end: 3.0, rect: [36, 314, 1152, 178] },
              { at: 3.1, rect: [36, 506, 1152, 107], color: colors.alert },
            ]}
            eyebrow="Visão geral"
            title="Resultado, caixa e risco numa tela só."
            body="O painel já aponta onde crescer e onde conter."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Operações" durationInFrames={s(5)}>
          <ProductScene
            chapter={2}
            totalChapters={CHAPTERS}
            chapterLabel="Operações"
            images={[{ src: "screens/operacoes.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [0, 170, 1600, 1000] },
            ]}
            marks={[{ at: 1.3, rect: [36, 430, 1528, 94] }]}
            eyebrow="Operações"
            title="A esteira inteira, numa fila só."
            body="Quem está com cada operação, em que etapa e há quanto tempo."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Etapas" durationInFrames={s(6)}>
          <ProductScene
            chapter={3}
            totalChapters={CHAPTERS}
            chapterLabel="Operação"
            images={[{ src: "screens/operacao-etapas.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [0, 100, 1300, 812] },
              { at: 2.9, rect: [0, 300, 1300, 812] },
            ]}
            marks={[
              { at: 1.3, end: 2.8, rect: [36, 230, 1194, 90] },
              { at: 3.5, rect: [64, 700, 1160, 216] },
            ]}
            eyebrow="Operação"
            title="Da entrada à liberação, em 6 etapas."
            body="Cada etapa com a política aplicada, regra por regra."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Risco" durationInFrames={s(7)}>
          <ProductScene
            chapter={4}
            totalChapters={CHAPTERS}
            chapterLabel="Risco"
            images={[{ src: "screens/operacao-risco.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [40, 220, 1240, 775] },
            ]}
            marks={[
              { at: 1.3, end: 2.8, rect: [64, 390, 546, 330] },
              { at: 2.9, rect: [624, 390, 600, 610], color: colors.decide },
            ]}
            eyebrow="Análise de risco"
            title="Cada sacado com score e histórico."
            body="A recomendação vem com o motivo. A decisão é sua."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Copiloto" durationInFrames={s(8)}>
          <ProductScene
            chapter={5}
            totalChapters={CHAPTERS}
            chapterLabel="Copiloto"
            images={[
              { src: "screens/copiloto.jpg", at: 0 },
              { src: "screens/copiloto-evidencias.jpg", at: 2.7 },
            ]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.4, rect: [860, 140, 760, 800] },
              { at: 2.7, rect: [0, 0, 1180, 738] },
            ]}
            marks={[{ at: 3.6, rect: [26, 218, 1108, 454] }]}
            eyebrow="Pergunte ao Copiloto"
            title="Pergunte. A resposta vem com a fonte."
            body="Cada número mostra de onde veio: carteira, operação ou cadastro."
          >
            <Cursor from={[1250, 960]} to={[1520, 770]} start={1.2} click={2.3} unit={0.8} />
          </ProductScene>
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Carteira" durationInFrames={s(9)}>
          <ProductScene
            chapter={6}
            totalChapters={CHAPTERS}
            chapterLabel="Carteira"
            images={[{ src: "screens/carteira.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [0, 330, 1340, 838] },
            ]}
            marks={[{ at: 1.3, rect: [36, 480, 1044, 520] }]}
            eyebrow="Carteira e cobrança"
            title="Quem cobrar hoje, e em que ordem."
            body="Fila priorizada pelo risco, com a régua aplicada a cada título."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Financeiro" durationInFrames={s(10)}>
          <ProductScene
            chapter={7}
            totalChapters={CHAPTERS}
            chapterLabel="Financeiro"
            images={[{ src: "screens/financeiro.jpg", at: 0 }]}
            camera={[
              { at: 0, rect: FULL },
              { at: 0.5, rect: [0, 260, 1600, 1000] },
            ]}
            marks={[{ at: 1.3, rect: [36, 600, 1528, 400] }]}
            eyebrow="Financeiro"
            title="Caixa, bancos e conciliação juntos."
            body="Saldos e extratos ao lado da operação que os gerou."
          />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Manifesto" durationInFrames={s(11)}>
          <Manifesto footnote="Cálculos e alçadas continuam determinísticos. Cada passo fica registrado." />
        </TransitionSeries.Sequence>
        {cut()}
        <TransitionSeries.Sequence name="Assinatura" durationInFrames={s(12)}>
          <EndCard
            slogan={slogan}
            sloganAccent={sloganAccent}
            segments="FACTORING · FIDC · SECURITIZADORA"
            cta={cta}
            contact={contact}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
