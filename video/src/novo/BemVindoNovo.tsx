import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "../brand/fonts";
import { clamp, colors, ease, fontFamily } from "../brand/tokens";
import { Background } from "../components/Background";
import { beat, DataRain, DROP, Flash, Kicker, Phone, punch, shake, SlamWord } from "./kit";

// Vídeo vertical (1080×1920) "Bem-vindo ao novo": chegada do STRATO para redes sociais.
// Cortes no tempo da trilha (120 BPM, impacto em 4 s). Telas reais do modo demonstração, dados fictícios.

export const NOVO_FRAMES = 1080;

const OLD = ["Planilhas.", "Telas demais.", "E-mails perdidos.", "Conferência manual.", "Sistemas que não conversam."];

// 0–4 s: o mundo antigo em cortes nervosos, com glitch e tremor.
const OldWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const i = Math.min(OLD.length - 1, Math.floor(frame / 20));
  const local = frame - i * 20;
  const split = 8 + 10 * Math.abs(Math.sin(frame * 1.3));
  const jitter = (random(`j${Math.floor(frame / 2)}`) - 0.5) * 30;
  const black = frame >= 104;
  return (
    <AbsoluteFill style={{ background: "#05070D" }}>
      {Array.from({ length: 14 }, (_, k) => {
        const show = frame > k * 6;
        const x = random(`wx${k}`) * 900 - 40;
        const y = random(`wy${k}`) * 1700;
        return show && !black ? (
          <div key={k} style={{ position: "absolute", left: x, top: y + Math.sin(frame / 5 + k) * 10, width: 260 + random(`ww${k}`) * 200, height: 150 + random(`wh${k}`) * 120, borderRadius: 10, background: "rgba(148,163,184,0.08)", border: "1px solid rgba(248,113,113,0.35)", rotate: `${(random(`wr${k}`) - 0.5) * 18}deg` }}>
            <div style={{ height: 22, background: "rgba(248,113,113,0.18)", borderRadius: "10px 10px 0 0" }} />
            {[0, 1, 2].map(r => (
              <div key={r} style={{ margin: "14px 16px 0", height: 10, width: `${40 + random(`l${k}${r}`) * 50}%`, background: "rgba(226,232,255,0.15)", borderRadius: 4 }} />
            ))}
          </div>
        ) : null;
      })}
      {!black ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", translate: `${jitter}px 0px` }}>
          <div style={{ position: "relative", fontSize: 104, fontWeight: 900, letterSpacing: "-0.03em", textAlign: "center", padding: "0 60px", lineHeight: 1, scale: String(interpolate(local, [0, 4, 20], [1.4, 1, 0.94], clamp)) }}>
            <span style={{ position: "absolute", inset: 0, color: "#F87171", translate: `${-split}px 0px`, opacity: 0.7 }}>{OLD[i]}</span>
            <span style={{ position: "absolute", inset: 0, color: "#38BDF8", translate: `${split}px 0px`, opacity: 0.7 }}>{OLD[i]}</span>
            <span style={{ position: "relative", color: colors.white }}>{OLD[i]}</span>
          </div>
        </AbsoluteFill>
      ) : null}
      {/* Linhas de varredura de TV antiga. */}
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 5px)", opacity: black ? 0 : 1 }} />
      {black ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: colors.textSoft, fontSize: 46, fontWeight: 600, letterSpacing: "0.3em", opacity: interpolate(frame, [104, 108, 118, 120], [0, 1, 1, 0], clamp) }}>
          CHEGA.
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

// 4–7 s: impacto — BEM-VINDO AO NOVO.
const Welcome: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sh = shake(frame, 0, 26, 14);
  const ring = interpolate(frame, [0, 28], [0, 1], { ...clamp, easing: ease.out });
  const zoom = interpolate(frame, [0, 90], [1, 1.12]);
  return (
    <AbsoluteFill style={{ translate: `${sh.x}px ${sh.y}px` }}>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 1600, height: 1600, borderRadius: "50%", border: `6px solid ${colors.accent}`, opacity: (1 - ring) * 0.8, scale: String(0.1 + ring * 1.2) }} />
        <div style={{ scale: String(punch(frame, fps, 0, 1.4) * zoom), textAlign: "center" }}>
          <SlamWord text="BEM-VINDO" at={0} size={168} stagger={2} />
          <SlamWord text="AO NOVO." at={14} size={210} stagger={3} color={colors.accent} style={{ marginTop: 10, textShadow: `0 0 60px ${colors.accentStrong}` }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 7–11 s: a marca é construída em camadas (strato = camadas) que se encaixam no tempo da batida.
const LogoBuild: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SLICES = 7;
  const W = 820;
  const H = 210; // proporção aproximada do logotipo horizontal
  const done = frame >= 6 + SLICES * 7 + 6;
  const sweep = interpolate(frame, [62, 92], [-0.3, 1.3], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 9 }, (_, k) => {
          const d = interpolate(frame, [k * 3, k * 3 + 20], [0, 1], { ...clamp, easing: ease.out });
          return <line key={k} x1={0} y1={560 + k * 100} x2={1080 * d} y2={560 + k * 100} stroke={colors.accent} strokeOpacity={0.12} strokeWidth={2} />;
        })}
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: W, height: H, scale: String(done ? punch(frame, fps, 6 + SLICES * 7 + 6, 1.15) : 1) }}>
          {Array.from({ length: SLICES }, (_, k) => {
            const at = 6 + k * 7;
            const p = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 160 } });
            const dir = k % 2 ? 1 : -1;
            return (
              <div key={k} style={{ position: "absolute", left: 0, top: (H / SLICES) * k, width: W, height: H / SLICES + 1, overflow: "hidden", translate: `${(1 - p) * dir * 900}px 0px`, opacity: interpolate(p, [0, 0.2], [0, 1], clamp) }}>
                <Img src={staticFile("strato-logo.png")} style={{ position: "absolute", left: 0, top: -(H / SLICES) * k, width: W, height: H, objectFit: "contain" }} />
              </div>
            );
          })}
          {/* Brilho que atravessa a marca pronta. */}
          <div style={{ position: "absolute", inset: -20, background: `linear-gradient(100deg, transparent ${sweep * 100 - 12}%, rgba(255,255,255,0.75) ${sweep * 100}%, transparent ${sweep * 100 + 12}%)`, mixBlendMode: "overlay", WebkitMaskImage: `url(${staticFile("strato-logo.png")})`, WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center" }} />
        </div>
        <div style={{ position: "absolute", top: 1180, color: colors.textSoft, fontSize: 38, fontWeight: 600, letterSpacing: "0.22em", opacity: interpolate(frame, [70, 82], [0, 1], clamp), translate: `0px ${interpolate(frame, [70, 86], [30, 0], clamp)}px` }}>
          CAMADA POR CAMADA.
        </div>
      </AbsoluteFill>
      <Flash at={6 + SLICES * 7 + 6} dur={8} color={colors.accent} />
    </AbsoluteFill>
  );
};

// Capítulo com celular: rótulo, título e tela real com efeito próprio.
const Chapter: React.FC<{
  kicker: string;
  title: React.ReactNode;
  src: string;
  scroll: [number, number];
  color?: string;
  overlay?: React.ReactNode;
  rain?: boolean;
  tilt?: number;
}> = ({ kicker, title, src, scroll, color = colors.accent, overlay, rain, tilt = -6 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const y = interpolate(frame, [6, durationInFrames], scroll, { ...clamp, easing: ease.inOut });
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Background />
      {rain ? <DataRain opacity={0.22} seed={kicker} /> : null}
      <div style={{ position: "absolute", top: 150, left: 80, right: 80, translate: `${-exit * 200}px 0px`, opacity: 1 - exit }}>
        <Kicker text={kicker} at={0} color={color} />
        <div style={{ marginTop: 18, color: colors.white, fontSize: 96, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, translate: `0px ${(1 - enter) * 60}px`, opacity: enter }}>{title}</div>
      </div>
      <div style={{ position: "absolute", left: 240, top: 540, rotate: `${tilt * (1 - enter * 0.6) + Math.sin(frame / 20) * 1.2}deg`, translate: `${(1 - enter) * 700 + exit * 900}px ${Math.sin(frame / 14) * 8}px`, scale: String(1 + exit * 0.2) }}>
        <Phone src={src} scroll={y} w={600} glow={color}>
          {overlay}
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

// Sobreposição de automação: etapas sendo concluídas sozinhas.
const AutoSteps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = ["Cadastro", "Lastro", "Política de crédito", "Formalização", "Liberação"];
  return (
    <div style={{ position: "absolute", left: 24, right: 24, bottom: 40, padding: 22, borderRadius: 28, background: "rgba(7,18,51,0.94)", boxShadow: "0 20px 60px rgba(2,6,23,0.5)" }}>
      {steps.map((s, i) => {
        const at = 18 + i * 12;
        const p = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 220 } });
        const ok = frame >= at;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 4px", color: ok ? colors.white : colors.textFaint, fontSize: 30, fontWeight: 700 }}>
            <span style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: ok ? colors.decide : "rgba(255,255,255,0.08)", color: colors.navy950, fontSize: 24, scale: String(ok ? 0.6 + p * 0.4 : 1) }}>{ok ? "✓" : ""}</span>
            {s}
            <span style={{ marginLeft: "auto", fontSize: 20, color: ok ? colors.decide : colors.textFaint }}>{ok ? "automático" : "…"}</span>
          </div>
        );
      })}
    </div>
  );
};

// Sobreposição de dados: número subindo e barras crescendo.
const DataBurst: React.FC = () => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [10, 60], [0, 6.42], { ...clamp, easing: ease.out });
  return (
    <div style={{ position: "absolute", left: 24, right: 24, bottom: 40, padding: "26px 28px", borderRadius: 28, background: "rgba(7,18,51,0.94)", color: colors.white }}>
      <div style={{ fontSize: 20, letterSpacing: "0.2em", color: colors.accent, fontWeight: 800 }}>VOLUME ORIGINADO</div>
      <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: "-0.03em" }}>R$ {v.toFixed(2).replace(".", ",")} mi</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, marginTop: 12 }}>
        {[0.35, 0.5, 0.42, 0.68, 0.6, 0.82, 0.74, 1].map((h, i) => (
          <div key={i} style={{ flex: 1, borderRadius: 8, background: i === 7 ? colors.accent : "rgba(122,167,255,0.35)", height: `${h * 100 * interpolate(frame, [14 + i * 4, 30 + i * 4], [0, 1], { ...clamp, easing: ease.out })}%` }} />
        ))}
      </div>
    </div>
  );
};

// Sobreposição de decisão: toque no botão e confirmação.
const DecideTap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tap = 40;
  const ripple = interpolate(frame, [tap, tap + 18], [0, 1], clamp);
  const ok = spring({ frame: frame - tap - 8, fps, config: { damping: 10, stiffness: 180 } });
  // Primeiro botão "Decidir" da tela real (fração da largura e altura exibida).
  const fx = 452;
  const fy = interpolate(frame, [0, tap], [1100, 272], { ...clamp, easing: ease.inOut });
  return (
    <>
      <div style={{ position: "absolute", left: fx - 50, top: fy - 50, width: 100, height: 100, borderRadius: "50%", background: "rgba(59,107,255,0.25)", border: "4px solid rgba(255,255,255,0.9)", boxShadow: "0 10px 30px rgba(2,6,23,0.4)", scale: String(frame >= tap && frame < tap + 6 ? 0.8 : 1) }} />
      {frame >= tap ? <div style={{ position: "absolute", left: fx - 90, top: fy - 90, width: 180, height: 180, borderRadius: "50%", border: `5px solid ${colors.accentStrong}`, opacity: 1 - ripple, scale: String(0.3 + ripple * 1.4) }} /> : null}
      {frame >= tap + 8 ? (
        <div style={{ position: "absolute", left: 40, right: 40, top: 560, padding: "30px 26px", borderRadius: 28, background: colors.decide, color: colors.navy950, textAlign: "center", fontSize: 50, fontWeight: 900, opacity: ok, scale: String(0.6 + ok * 0.4), boxShadow: "0 30px 80px rgba(52,211,153,0.5)" }}>
          ✓ Decidido.
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>com contexto, alçada e trilha de auditoria</div>
        </div>
      ) : null}
    </>
  );
};

// 23–28 s: na palma da mão — o celular troca de tela a cada batida.
const PalmOfHand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const screens = ["novo/m-dia.png", "novo/m-home.png", "novo/m-ops.png", "novo/m-carteira.png", "novo/m-fin.png", "novo/m-home.png", "novo/m-dia.png", "novo/m-ops.png", "novo/m-fin.png", "novo/m-home.png"];
  const idx = Math.min(screens.length - 1, Math.floor(frame / 15));
  const kick = spring({ frame: frame - idx * 15, fps, config: { damping: 10, stiffness: 260 } });
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ marginTop: 150, textAlign: "center" }}>
          <SlamWord text="Tudo na palma" at={0} size={104} stagger={1} />
          <SlamWord text="da sua mão." at={8} size={104} stagger={1} color={colors.accent} />
        </div>
        <div style={{ marginTop: 60, rotate: `${Math.sin(frame / 18) * 4}deg`, scale: String(0.94 + kick * 0.06), translate: `0px ${Math.sin(frame / 12) * 12}px` }}>
          <Phone src={screens[idx]} w={560} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 28–32 s: tudo a um só olhar — várias telas convergem para uma.
const OneGlance: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const screens = ["novo/m-ops.png", "novo/m-carteira.png", "novo/m-fin.png", "novo/m-dia.png", "novo/m-home.png"];
  const join = interpolate(frame, [40, durationInFrames - 10], [0, 1], { ...clamp, easing: ease.inOut });
  const POS: [number, number, number][] = [[-330, -420, -12], [330, -380, 10], [-340, 420, 8], [340, 440, -9], [0, 0, 0]];
  return (
    <AbsoluteFill>
      <Background />
      <DataRain opacity={0.12} seed="glance" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        {screens.map((s, i) => {
          const [x, y, r] = POS[i];
          const show = interpolate(frame, [i * 5, i * 5 + 10], [0, 1], clamp);
          return (
            <div key={i} style={{ position: "absolute", translate: `${x * (1 - join)}px ${y * (1 - join) + 120}px`, rotate: `${r * (1 - join)}deg`, scale: String((i === 4 ? 0.62 : 0.42) * (1 - join) + 0.62 * join), opacity: i === 4 ? 1 : show * (1 - join * 0.9), zIndex: i === 4 ? 5 : 1 }}>
              <Phone src={s} w={640} />
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 140, left: 0, right: 0, textAlign: "center" }}>
        <SlamWord text="Tudo a um" at={2} size={110} stagger={1} />
        <SlamWord text="só olhar." at={10} size={110} stagger={1} color={colors.accent} />
      </div>
    </AbsoluteFill>
  );
};

// 32–36 s: assinatura final.
const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const ring = interpolate(frame, [0, 30], [0, 1], { ...clamp, easing: ease.out });
  return (
    <AbsoluteFill style={{ translate: `${shake(frame, 0, 16, 10).x}px 0px` }}>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ position: "absolute", width: 1400, height: 1400, borderRadius: "50%", border: `4px solid ${colors.accent}`, opacity: (1 - ring) * 0.7, scale: String(0.1 + ring * 1.1) }} />
        <Img src={staticFile("strato-logo.png")} style={{ width: 760, opacity: logo, scale: String(0.6 + logo * 0.4), filter: `drop-shadow(0 0 ${40 * logo}px ${colors.accentStrong})` }} />
        <div style={{ marginTop: 70 }}>
          <SlamWord text="Veja o todo." at={14} size={86} stagger={1} />
          <SlamWord text="Decida com precisão." at={24} size={76} stagger={1} color={colors.accent} style={{ marginTop: 8 }} />
        </div>
        <div style={{ marginTop: 70, display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 38px", borderRadius: 999, border: `2px solid ${colors.accent}`, background: "rgba(59,107,255,0.16)", color: colors.white, fontSize: 40, fontWeight: 800, letterSpacing: "0.24em", opacity: interpolate(frame, [44, 54], [0, 1], clamp), scale: String(interpolate(frame, [44, 54], [1.4, 1], { ...clamp, easing: ease.out })) }}>
          <span style={{ width: 16, height: 16, borderRadius: "50%", background: colors.decide, boxShadow: `0 0 16px ${colors.decide}` }} />
          EM BREVE
        </div>
        <div style={{ marginTop: 40, color: colors.textSoft, fontSize: 28, fontWeight: 700, letterSpacing: "0.2em", opacity: interpolate(frame, [58, 70], [0, 1], clamp) }}>FACTORING · FIDC · SECURITIZADORA</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center", color: colors.textFaint, fontSize: 22 }}>Telas reais em ambiente de demonstração · dados fictícios</div>
    </AbsoluteFill>
  );
};

// Linha do tempo (frames): cada corte cai numa batida da trilha.
const CUTS = {
  welcome: DROP,
  logo: beat(6),
  auto: beat(14),
  data: beat(22),
  decide: beat(30),
  palm: beat(38),
  glance: beat(48),
  finale: beat(56),
};

export const BemVindoNovo: React.FC<{ music: boolean }> = ({ music }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: colors.navy950 }}>
      <Sequence durationInFrames={CUTS.welcome} name="mundo antigo">
        <OldWorld />
      </Sequence>
      <Sequence from={CUTS.welcome} durationInFrames={CUTS.logo - CUTS.welcome} name="bem-vindo">
        <Welcome />
      </Sequence>
      <Sequence from={CUTS.logo} durationInFrames={CUTS.auto - CUTS.logo} name="marca">
        <LogoBuild />
      </Sequence>
      <Sequence from={CUTS.auto} durationInFrames={CUTS.data - CUTS.auto} name="automação">
        <Chapter kicker="AUTOMAÇÃO" title={<>O fluxo anda<br />sozinho.</>} src="novo/m-ops-full.png" scroll={[0, 600]} color={colors.decide} overlay={<AutoSteps />} />
      </Sequence>
      <Sequence from={CUTS.data} durationInFrames={CUTS.decide - CUTS.data} name="dados">
        <Chapter kicker="DADOS" title={<>Números vivos,<br />em tempo real.</>} src="novo/m-fin-full.png" scroll={[0, 900]} overlay={<DataBurst />} rain tilt={6} />
      </Sequence>
      <Sequence from={CUTS.decide} durationInFrames={CUTS.palm - CUTS.decide} name="decisão">
        <Chapter kicker="DECISÃO" title={<>Um toque.<br />Decidido.</>} src="novo/m-home-full.png" scroll={[3230, 3230]} color="#F59E0B" overlay={<DecideTap />} />
      </Sequence>
      <Sequence from={CUTS.palm} durationInFrames={CUTS.glance - CUTS.palm} name="palma da mão">
        <PalmOfHand />
      </Sequence>
      <Sequence from={CUTS.glance} durationInFrames={CUTS.finale - CUTS.glance} name="um só olhar">
        <OneGlance />
      </Sequence>
      <Sequence from={CUTS.finale} name="assinatura">
        <Finale />
      </Sequence>
      {/* Flashes nos cortes principais. */}
      {[CUTS.welcome, CUTS.auto, CUTS.data, CUTS.decide, CUTS.palm, CUTS.glance, CUTS.finale].map(c => (
        <Flash key={c} at={c} dur={c === CUTS.welcome || c === CUTS.finale ? 10 : 5} />
      ))}
      {/* Barra de progresso fina no topo, típica de stories. */}
      <div style={{ position: "absolute", top: 0, left: 0, height: 6, width: `${(frame / NOVO_FRAMES) * 100}%`, background: colors.accent, opacity: 0.7 }} />
      {music ? <Audio src={staticFile("novo/music.mp3")} volume={f => interpolate(f, [NOVO_FRAMES - 30, NOVO_FRAMES], [1, 0], clamp)} /> : null}
    </AbsoluteFill>
  );
};
