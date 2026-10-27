import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp } from "../brand/tokens";
import { Backdrop, Browser, display, expo, Glass, Grad, Grain, ink, Label, Leak, LOGO, LogoVector, MaskLine, mono, Mouse, Scramble, snap, useL } from "./premium";

// "Bem-vindo ao novo" — chegada do STRATO para redes sociais, em 9:16 e 16:9 (mesmas cenas, layout responsivo).
// Cortes no tempo da trilha (120 BPM, impacto em 4 s). Somente telas reais de computador (modo demonstração, dados fictícios).

export const NOVO_FRAMES = 1080;
const DROP = 120;
const beat = (n: number) => DROP + n * 15;
const CUT = { drop: DROP, logo: beat(6), auto: beat(18), data: beat(26), decide: beat(34), palm: beat(42), glance: beat(49), finale: beat(56) };

/** Entrada e saída de cena: leve zoom com desfoque (corte "respirado"). */
const Shot: React.FC<{ children: React.ReactNode; out?: boolean }> = ({ children, out = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const i = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: expo });
  const o = out ? interpolate(frame, [durationInFrames - 8, durationInFrames], [0, 1], { ...clamp, easing: snap }) : 0;
  return <AbsoluteFill style={{ scale: String(1.06 - i * 0.06 + o * 0.08), filter: `blur(${(1 - i) * 10 + o * 14}px)`, opacity: 1 - o * 0.6 }}>{children}</AbsoluteFill>;
};

// 0–4 s: as dores aparecem em mono, são riscadas e colapsam num ponto de luz.
const PAINS = ["sistemas complexos", "telas demais", "informação espalhada", "nenhuma visão do negócio"];
const Before: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, v } = useL();
  const collapse = interpolate(frame, [92, 108], [0, 1], { ...clamp, easing: snap });
  const size = (v ? 46 : 40) * u;
  return (
    <AbsoluteFill style={{ background: ink.bg, alignItems: "center", justifyContent: "center" }}>
      <div style={{ scale: `${1 - collapse * 0.9} ${1 - collapse}`, opacity: 1 - collapse * 0.8 }}>
        {PAINS.map((p, i) => {
          const at = 6 + i * 20;
          const strike = interpolate(frame, [at + 14, at + 24], [0, 1], { ...clamp, easing: expo });
          return (
            <div key={p} style={{ position: "relative", margin: `${size * 0.5}px 0`, fontSize: size, color: "rgba(226,232,255,0.55)", textAlign: "center", letterSpacing: "0.04em" }}>
              <Scramble text={p} at={at} dur={14} />
              <span style={{ position: "absolute", left: "-4%", top: "52%", height: 2, width: `${strike * 108}%`, background: "#F87171", boxShadow: "0 0 12px #F87171" }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", width: 14 * u, height: 14 * u, borderRadius: "50%", background: "#fff", boxShadow: `0 0 ${40 * u}px ${12 * u}px ${ink.sky}`, opacity: interpolate(frame, [100, 106, 119], [0, 1, 1], clamp), scale: String(1 + 0.3 * Math.sin(frame / 2)) }} />
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};

// 4–7 s: impacto — Bem-vindo ao novo.
const Welcome: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, v } = useL();
  const ring = interpolate(frame, [0, 30], [0, 1], { ...clamp, easing: expo });
  const size = (v ? 190 : 210) * u;
  return (
    <Shot>
      <Backdrop glow={interpolate(frame, [0, 20], [2.2, 1], clamp)} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 1400 * u, height: 1400 * u, borderRadius: "50%", border: `${2 * u}px solid ${ink.sky}`, opacity: (1 - ring) * 0.9, scale: String(0.02 + ring) }} />
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, letterSpacing: "-0.055em", lineHeight: 0.92, color: "#fff", textAlign: v ? "left" : "center", scale: String(1 + frame * 0.0009) }}>
          <MaskLine at={2} dur={20} out={78}>Bem-vindo</MaskLine>
          <MaskLine at={9} dur={20} out={80}>
            <Grad>ao novo.</Grad>
          </MaskLine>
        </div>
        <div style={{ position: "absolute", bottom: (v ? 260 : 120) * u, fontSize: 24 * u, color: ink.sky, letterSpacing: "0.3em" }}>
          <Scramble text="STRATO · 2026" at={24} dur={16} />
        </div>
      </AbsoluteFill>
      <Leak at={0} dur={18} color="#ffffff" />
    </Shot>
  );
};

// 7–13 s: a marca é desenhada traço a traço, as camadas se encaixam e o nome se acende.
const LogoBuild: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, v } = useL();
  const width = (v ? 900 : 1300) * u;
  const s = LOGO.width / width; // unidades do SVG por pixel
  const tiltP = interpolate(frame, [0, 110], [0, 1], { ...clamp, easing: expo });
  const join = interpolate(frame, [62, 84], [0, 1], { ...clamp, easing: snap });
  const settle = spring({ frame: frame - 84, fps, config: { damping: 9, stiffness: 220 } });
  const markFill = interpolate(frame, [52, 72], [0, 1], clamp);
  const sweep = interpolate(frame, [128, 168], [-0.3, 1.3], clamp);
  const ringP = interpolate(frame, [84, 116], [0, 1], { ...clamp, easing: expo });
  // Guias isométricas (30°) que antecipam a geometria da marca.
  const guides = [
    [0, 140, 600, 486], [0, 380, 600, 34], [40, 0, 560, 323], [-20, 520, 560, 197],
  ];
  return (
    <Shot>
      <Backdrop glow={0.8} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2200 * u }}>
        <div style={{ transform: `rotateX(${(1 - tiltP) * 38}deg) rotateZ(${(1 - tiltP) * -6}deg) scale(${0.9 + tiltP * 0.1})`, transformStyle: "preserve-3d" }}>
          <svg width={width} height={(width * LOGO.height) / LOGO.width} viewBox={`-40 -60 ${LOGO.width + 80} ${LOGO.height + 120}`} style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="lb-f" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor={ink.ice} />
              </linearGradient>
              <filter id="lb-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={6 * s} result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {guides.map(([x1, y1, x2, y2], i) => {
              const d = interpolate(frame, [i * 4, i * 4 + 26], [0, 1], { ...clamp, easing: expo });
              return <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * d} y2={y1 + (y2 - y1) * d} stroke={ink.sky} strokeWidth={1.2 * s} strokeDasharray={`${6 * s} ${8 * s}`} opacity={0.5 * (1 - join)} />;
            })}
            {LOGO.parts.map((p, i) => {
              const mark = i < 2;
              const at = mark ? 8 + i * 10 : 70 + (i - 2) * 6;
              const draw = interpolate(frame, [at, at + (mark ? 44 : 22)], [0, 1], { ...clamp, easing: expo });
              // Camadas do símbolo começam afastadas (explodidas) e se encaixam no impacto.
              const off = mark ? (i === 0 ? 70 : -110) * (1 - join) + (i === 0 ? 1 : -1) * (1 - settle) * 10 * (frame > 84 ? 1 : 0) : 0;
              const fillP = mark ? markFill : interpolate(frame, [at + 12, at + 24], [0, 1], clamp);
              return (
                <g key={i} transform={`translate(0 ${off})`}>
                  <path d={p.d} fill="url(#lb-f)" fillRule="evenodd" opacity={fillP} />
                  <path d={p.d} pathLength={1} fill="none" stroke={ink.sky} strokeWidth={2.6 * s} strokeDasharray="1 1" strokeDashoffset={1 - draw} opacity={1 - fillP * 0.85} filter="url(#lb-glow)" />
                </g>
              );
            })}
          </svg>
        </div>
        {/* Onda de encaixe das camadas. */}
        <div style={{ position: "absolute", width: 900 * u, height: 900 * u, borderRadius: "50%", border: `${2 * u}px solid ${ink.sky}`, opacity: frame > 84 ? (1 - ringP) * 0.8 : 0, scale: String(0.1 + ringP) }} />
        <div style={{ position: "absolute", top: "50%", marginTop: (v ? 200 : 230) * u, fontSize: (v ? 26 : 24) * u, letterSpacing: "0.32em", color: "rgba(226,232,255,0.7)" }}>
          <Scramble text="CAMADA POR CAMADA." at={100} dur={20} />
        </div>
      </AbsoluteFill>
      {/* Brilho final por cima da marca já pronta. */}
      {frame >= 124 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ marginTop: 0 }}>
            <div style={{ width, height: (width * LOGO.height) / LOGO.width, padding: 0 }}>
              <svg width={width} height={(width * LOGO.height) / LOGO.width} viewBox={`-40 -60 ${LOGO.width + 80} ${LOGO.height + 120}`} style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="lb-sw" x1="0" y1="0" x2="1" y2="0">
                    <stop offset={Math.max(0, sweep - 0.1)} stopColor="#fff" stopOpacity="0" />
                    <stop offset={Math.min(1, Math.max(0, sweep))} stopColor="#fff" stopOpacity="0.9" />
                    <stop offset={Math.min(1, Math.max(0, sweep + 0.1))} stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="lb-c">
                    {LOGO.parts.map((p, i) => (
                      <path key={i} d={p.d} clipRule="evenodd" />
                    ))}
                  </clipPath>
                </defs>
                <rect x={0} y={0} width={LOGO.width} height={LOGO.height} fill="url(#lb-sw)" clipPath="url(#lb-c)" />
              </svg>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
      <Leak at={84} dur={16} />
    </Shot>
  );
};

type Chip = { at: number; x: number; y: number; node: React.ReactNode; accent?: string };
type Cam = { x: number; y: number; vw: number }; // canto e largura visível em px CSS da tela real
type Click = { at: number; x: number; y: number }; // alvo em px CSS da tela real
type Mark = { at: number; x: number; y: number; w: number; h: number };

// Capítulo: rótulo mono, título em máscara, tela real de computador com câmera, mouse e cartões de vidro.
const Chapter: React.FC<{ n: string; label: string; color: string; lines: React.ReactNode[]; sub: string; src: string; cam: [Cam, Cam]; chips: Chip[]; click?: Click; marks?: Mark[] }> = ({ n, label, color, lines, sub, src, cam, chips, click, marks = [] }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { u, v, W, H } = useL();
  const enter = spring({ frame: frame - 2, fps, config: { damping: 18, stiffness: 90 } });
  const k = interpolate(frame, [8, durationInFrames - 10], [0, 1], { ...clamp, easing: expo });
  const bw = (v ? 980 : 1080) * u;
  const bh = (v ? 820 : 700) * u;
  const bx = v ? (W - bw) / 2 : W - bw - 90 * u;
  const by = v ? H - bh - 170 * u : (H - bh) / 2 + 20 * u;
  const vw = cam[0].vw + (cam[1].vw - cam[0].vw) * k;
  const c = { x: cam[0].x + (cam[1].x - cam[0].x) * k, y: cam[0].y + (cam[1].y - cam[0].y) * k, z: bw / vw };
  const bar = Math.max(30, bw * 0.034);
  const toScreen = (px: number, py: number) => ({ x: (px - c.x) * c.z, y: bar + (py - c.y) * c.z });
  // Mouse: entra pela borda e chega ao alvo pouco antes do clique.
  const m = click ? toScreen(click.x, click.y) : null;
  const mp = click ? interpolate(frame, [click.at - 26, click.at - 2], [0, 1], { ...clamp, easing: expo }) : 0;
  const titleSize = (v ? 104 : 92) * u;
  return (
    <Shot>
      <Backdrop hue={color} glow={0.9} />
      <div style={{ position: "absolute", left: (v ? 80 : 120) * u, top: (v ? 160 : 250) * u, width: (v ? 920 : 640) * u }}>
        <Label n={n} text={label} at={2} color={color} size={22 * u} />
        <div style={{ marginTop: 26 * u, fontFamily: display, fontWeight: 750, fontSize: titleSize, letterSpacing: "-0.05em", lineHeight: 0.98, color: "#fff" }}>
          {lines.map((l, i) => (
            <MaskLine key={i} at={6 + i * 5} out={durationInFrames - 14}>
              {l}
            </MaskLine>
          ))}
        </div>
        <div style={{ marginTop: 26 * u, fontFamily: display, fontWeight: 400, fontSize: (v ? 34 : 28) * u, lineHeight: 1.35, color: "rgba(226,232,255,0.7)", opacity: interpolate(frame, [18, 30], [0, 1], clamp), translate: `0px ${interpolate(frame, [18, 34], [16, 0], { ...clamp, easing: expo })}px` }}>
          {sub}
        </div>
      </div>
      <div style={{ position: "absolute", left: bx, top: by + (1 - enter) * 160 * u, perspective: 2400 * u }}>
        <div style={{ position: "relative", transform: `rotateY(${(v ? 0 : -9) + (1 - enter) * -18 + Math.sin(frame / 45) * 1.5}deg) rotateX(${(v ? 6 : 3) + Math.cos(frame / 55) * 1.2}deg)`, opacity: enter, transformOrigin: v ? "50% 100%" : "100% 50%" }}>
          <Browser src={src} w={bw} h={bh} cam={c} sheen={interpolate(frame, [10, 70], [-0.3, 1.3], clamp)}>
            {marks.map((mk, i) => {
              const o = interpolate(frame, [mk.at, mk.at + 10], [0, 1], clamp);
              const p = toScreen(mk.x, mk.y);
              return <div key={i} style={{ position: "absolute", left: p.x - 8, top: p.y - bar - 8, width: mk.w * c.z + 16, height: mk.h * c.z + 16, borderRadius: 12, border: `3px solid ${color}`, boxShadow: `0 0 0 6px ${color}22, 0 0 24px ${color}aa`, opacity: o }} />;
            })}
          </Browser>
          {m && click ? <Mouse x={m.x + (1 - mp) * bw * 0.4} y={m.y + (1 - mp) * bh * 0.5} click={click.at} size={34 * u} /> : null}
        </div>
      </div>
      {chips.map((ch, i) => {
        const p = spring({ frame: frame - ch.at, fps, config: { damping: 14, stiffness: 140 } });
        return (
          <div key={i} style={{ position: "absolute", width: "max-content", left: bx + ch.x * bw, top: by + ch.y * bh, fontFamily: display, fontSize: (v ? 32 : 26) * u, opacity: p, translate: `${(1 - p) * 60 * u}px ${Math.sin(frame / 22 + i) * 6 * u}px`, scale: String(0.85 + p * 0.15) }}>
            <Glass accent={ch.accent ?? color}>{ch.node}</Glass>
          </div>
        );
      })}
    </Shot>
  );
};

const Check: React.FC<{ color: string; text: string; sub?: string }> = ({ color, text, sub }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.6em", whiteSpace: "nowrap" }}>
    <span style={{ width: "1.3em", height: "1.3em", borderRadius: "50%", background: color, color: ink.bg, display: "grid", placeItems: "center", fontWeight: 900, fontSize: "0.8em" }}>✓</span>
    <div>
      <div style={{ fontWeight: 650 }}>{text}</div>
      {sub ? <div style={{ fontFamily: mono, fontSize: "0.62em", opacity: 0.65, letterSpacing: "0.06em" }}>{sub}</div> : null}
    </div>
  </div>
);

const Counter: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [at, at + 40], [0, 6.42], { ...clamp, easing: expo });
  return (
    <div style={{ whiteSpace: "nowrap" }}>
      <div style={{ fontFamily: mono, fontSize: "0.55em", letterSpacing: "0.16em", opacity: 0.7 }}>VOLUME ORIGINADO</div>
      <div style={{ fontWeight: 800, fontSize: "1.6em", letterSpacing: "-0.03em" }}>R$ {v.toFixed(2).replace(".", ",")} mi</div>
    </div>
  );
};

const Spark: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const pts = [0.6, 0.52, 0.58, 0.4, 0.45, 0.3, 0.34, 0.18, 0.12];
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${i * 30},${p * 80}`).join(" ");
  const k = interpolate(frame, [at, at + 30], [0, 1], { ...clamp, easing: expo });
  return (
    <div style={{ whiteSpace: "nowrap" }}>
      <div style={{ fontFamily: mono, fontSize: "0.55em", letterSpacing: "0.16em", opacity: 0.7 }}>TAXA MÉDIA · 2,24% a.m.</div>
      <svg width={240} height={84} style={{ display: "block", marginTop: 6 }}>
        <path d={d} pathLength={1} fill="none" stroke={ink.sky} strokeWidth={3} strokeDasharray="1 1" strokeDashoffset={1 - k} strokeLinecap="round" />
      </svg>
    </div>
  );
};

// Aparelhos em traço (sem prints de celular): o mesmo sistema do monitor ao celular.
const DeviceLine: React.FC<{ kind: "monitor" | "laptop" | "tablet" | "phone"; at: number; size: number; screen?: string }> = ({ kind, at, size, screen }) => {
  const frame = useCurrentFrame();
  const d = interpolate(frame, [at, at + 22], [0, 1], { ...clamp, easing: expo });
  const dims = { monitor: [1.6, 1, 0.05], laptop: [1.35, 0.85, 0.05], tablet: [0.75, 1, 0.07], phone: [0.47, 0.95, 0.09] }[kind];
  const w = size * dims[0];
  const h = size * dims[1];
  const r = size * dims[2];
  const sw = Math.max(2, size * 0.012);
  const ip = r * 0.8;
  return (
    <div style={{ position: "relative", width: w, height: h + (kind === "monitor" ? size * 0.22 : kind === "laptop" ? size * 0.08 : 0) }}>
      <svg width={w} height={h} style={{ position: "absolute", overflow: "visible" }}>
        <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={r} pathLength={1} fill="rgba(122,167,255,0.05)" stroke={ink.sky} strokeWidth={sw} strokeDasharray="1 1" strokeDashoffset={1 - d} style={{ filter: `drop-shadow(0 0 ${size * 0.03}px ${ink.blue})` }} />
      </svg>
      {screen ? (
        <div style={{ position: "absolute", left: ip, top: ip, width: w - ip * 2, height: h - ip * 2, borderRadius: r * 0.4, overflow: "hidden", opacity: interpolate(frame, [at + 14, at + 26], [0, 1], clamp) }}>
          <Img src={staticFile(screen)} style={{ width: "100%" }} />
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: interpolate(frame, [at + 14, at + 26], [0, 0.9], clamp) }}>
          <svg width={w * 0.4} height={w * 0.4} viewBox={`0 0 ${LOGO.parts[1].bbox[0] + LOGO.parts[1].bbox[2]} ${LOGO.height}`}>
            {LOGO.parts.slice(0, 2).map((p, i) => (
              <path key={i} d={p.d} fill={ink.sky} fillRule="evenodd" />
            ))}
          </svg>
        </div>
      )}
      {kind === "monitor" ? <div style={{ position: "absolute", left: w / 2 - size * 0.18, top: h, width: size * 0.36, height: size * 0.2, background: `linear-gradient(180deg, ${ink.sky}55, transparent)`, opacity: d, clipPath: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)" }} /> : null}
      {kind === "laptop" ? <div style={{ position: "absolute", left: -size * 0.08, top: h, width: w + size * 0.16, height: size * 0.06, borderRadius: `0 0 ${size * 0.04}px ${size * 0.04}px`, border: `${sw}px solid ${ink.sky}`, opacity: d }} /> : null}
    </div>
  );
};

// 21–24,5 s: 100% responsivo — do monitor à palma da mão.
const Responsive: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, v } = useL();
  const size = (v ? 104 : 100) * u;
  const dev = (v ? 300 : 330) * u;
  return (
    <Shot>
      <Backdrop glow={1.1} />
      <div style={{ position: "absolute", left: (v ? 80 : 120) * u, top: (v ? 160 : 170) * u }}>
        <Label n="04" text="100% RESPONSIVO" at={0} size={22 * u} />
        <div style={{ marginTop: 24 * u, fontFamily: display, fontWeight: 800, fontSize: size, letterSpacing: "-0.055em", lineHeight: 0.98, color: "#fff" }}>
          <MaskLine at={4} out={durationInFrames - 12}>No computador.</MaskLine>
          <MaskLine at={9} out={durationInFrames - 12}>
            <Grad>Na palma da mão.</Grad>
          </MaskLine>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: (v ? 280 : 150) * u, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: (v ? 34 : 60) * u, flexWrap: v ? "wrap" : "nowrap", rowGap: 60 * u, padding: `0 ${60 * u}px`, translate: `0px ${interpolate(frame, [0, durationInFrames], [20, -20]) * u}px` }}>
        <DeviceLine kind="monitor" at={8} size={dev * (v ? 1.7 : 1.25)} screen="proscore/states/home.jpg" />
        <DeviceLine kind="laptop" at={20} size={dev * 0.85} />
        <DeviceLine kind="tablet" at={30} size={dev * 0.85} />
        <DeviceLine kind="phone" at={40} size={dev * 0.85} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: (v ? 190 : 70) * u, textAlign: "center", fontSize: 22 * u, letterSpacing: "0.3em", color: "rgba(226,232,255,0.6)" }}>
        <Scramble text="MONITOR · NOTEBOOK · TABLET · CELULAR" at={50} dur={24} />
      </div>
    </Shot>
  );
};

// 24,5–28 s: tudo a um só olhar — parede isométrica de telas reais que se recolhe numa só.
const WALL = ["mod-operacoes", "op-motor", "mod-carteira", "cfg-politicas", "home", "mod-financeiro", "mod-cadastros", "cop-answer", "mod-auditoria"];
const Glance: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, v } = useL();
  const cw = (v ? 520 : 560) * u;
  const ch = cw * 0.62;
  const gap = 40 * u;
  const flat = interpolate(frame, [52, durationInFrames - 6], [0, 1], { ...clamp, easing: snap });
  const dolly = interpolate(frame, [0, 60], [0, 1], { ...clamp, easing: expo });
  return (
    <Shot>
      <Backdrop glow={0.7} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2600 * u }}>
        <div style={{ position: "relative", width: cw * 3 + gap * 2, height: ch * 3 + gap * 2, transform: `rotateX(${(1 - flat) * 55}deg) rotateZ(${(1 - flat) * -32}deg) scale(${(0.8 + dolly * 0.25) * (1 - flat) + flat * (v ? 2.0 : 2.9)})`, transformStyle: "preserve-3d" }}>
          {WALL.map((s, i) => {
            const cx = i % 3;
            const cy = Math.floor(i / 3);
            const center = i === 4;
            const pop = interpolate(frame, [i * 3, i * 3 + 16], [0, 1], { ...clamp, easing: expo });
            return (
              <div key={s} style={{ position: "absolute", left: cx * (cw + gap), top: cy * (ch + gap), width: cw, height: ch, borderRadius: 18 * u, overflow: "hidden", background: "#fff", boxShadow: center ? `0 0 ${80 * u}px ${ink.blue}` : "0 30px 60px rgba(0,0,0,0.5)", border: center ? `${3 * u}px solid ${ink.sky}` : "1px solid rgba(255,255,255,0.2)", opacity: (center ? 1 : 1 - flat) * pop, transform: `translateZ(${(1 - pop) * -400 * u + (center ? 40 * u * (1 - flat) : 0)}px)` }}>
                <Img src={staticFile(`proscore/states/${s}.jpg`)} style={{ width: cw }} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* Placa escura sob o título para manter a leitura sobre a parede de telas. */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse ${v ? "90% 30% at 50% 14%" : "45% 38% at 50% 50%"}, rgba(3,6,15,0.85), transparent 75%)`, opacity: 1 - flat }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: v ? "flex-start" : "center", paddingTop: v ? 170 * u : 0 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: (v ? 120 : 140) * u, letterSpacing: "-0.055em", lineHeight: 0.95, color: "#fff", textAlign: "center", textShadow: "0 20px 60px rgba(0,0,0,0.6)", opacity: 1 - flat }}>
          <MaskLine at={4}>Tudo a um</MaskLine>
          <MaskLine at={9}>
            <Grad>só olhar.</Grad>
          </MaskLine>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};

// 32–36 s: assinatura.
const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, v } = useL();
  const lg = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const sweep = interpolate(frame, [20, 60], [-0.3, 1.3], clamp);
  const dot = 0.4 + 0.6 * Math.abs(Math.sin(frame / 8));
  return (
    <Shot out={false}>
      <Backdrop glow={1.2} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ opacity: lg, scale: String(0.92 + lg * 0.08), filter: `blur(${(1 - lg) * 12}px) drop-shadow(0 0 ${40 * u}px ${ink.blue}88)` }}>
          <LogoVector width={(v ? 760 : 820) * u} sweep={sweep} id="fin" />
        </div>
        <div style={{ marginTop: 80 * u, fontFamily: display, fontWeight: 750, fontSize: (v ? 92 : 84) * u, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#fff" }}>
          <MaskLine at={18}>Veja o todo.</MaskLine>
          <MaskLine at={24}>
            <Grad>Decida com precisão.</Grad>
          </MaskLine>
        </div>
        <div style={{ marginTop: 64 * u, display: "inline-flex", alignItems: "center", gap: 16 * u, padding: `${14 * u}px ${30 * u}px`, borderRadius: 999, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.06)", fontSize: 28 * u, letterSpacing: "0.3em", color: "#fff", opacity: interpolate(frame, [40, 50], [0, 1], clamp) }}>
          <span style={{ width: 12 * u, height: 12 * u, borderRadius: "50%", background: ink.green, boxShadow: `0 0 ${16 * u}px ${ink.green}`, opacity: dot }} />
          <Scramble text="EM BREVE" at={40} dur={16} />
        </div>
        <div style={{ marginTop: 36 * u, fontSize: 22 * u, letterSpacing: "0.3em", color: "rgba(226,232,255,0.55)" }}>
          <Scramble text="WEB E MOBILE" at={50} dur={14} />
        </div>
        <div style={{ marginTop: 14 * u, fontSize: 22 * u, letterSpacing: "0.3em", color: "rgba(226,232,255,0.55)" }}>
          <Scramble text="FACTORING · FIDC · SECURITIZADORA" at={58} dur={24} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 50 * u, left: 0, right: 0, textAlign: "center", fontFamily: mono, fontSize: 16 * u, letterSpacing: "0.12em", color: "rgba(226,232,255,0.35)" }}>TELAS REAIS · AMBIENTE DE DEMONSTRAÇÃO · DADOS FICTÍCIOS</div>
    </Shot>
  );
};

export const BemVindoNovo: React.FC<{ music: boolean }> = ({ music }) => {
  const { v } = useL();
  return (
    <AbsoluteFill style={{ fontFamily: display, backgroundColor: ink.bg }}>
      <Sequence durationInFrames={CUT.drop} name="antes">
        <Before />
      </Sequence>
      <Sequence from={CUT.drop} durationInFrames={CUT.logo - CUT.drop} name="bem-vindo">
        <Welcome />
      </Sequence>
      <Sequence from={CUT.logo} durationInFrames={CUT.auto - CUT.logo} name="marca">
        <LogoBuild />
      </Sequence>
      <Sequence from={CUT.auto} durationInFrames={CUT.data - CUT.auto} name="automação">
        <Chapter
          n="01"
          label="AUTOMAÇÃO"
          color={ink.green}
          lines={["O fluxo anda", <Grad key="g" to={ink.green}>sozinho.</Grad>]}
          sub="Lastro, política e alçada avaliados em sequência, sem planilha paralela."
          src="proscore/states/op-motor.jpg"
          cam={[{ x: 40, y: 640, vw: 1050 }, { x: 60, y: 860, vw: 980 }]}
          marks={[
            { at: 16, x: 85, y: 734, w: 740, h: 26 },
            { at: 30, x: 169, y: 1034, w: 883, h: 19 },
            { at: 40, x: 169, y: 1096, w: 808, h: 19 },
          ]}
          chips={[
            { at: 22, x: v ? 0.03 : -0.1, y: v ? -0.12 : 0.62, node: <Check color={ink.green} text="Lastro validado" sub="NF-e · duplicata" /> },
            { at: 32, x: v ? 0.5 : 0.62, y: v ? 0.08 : -0.06, node: <Check color={ink.green} text="Política aplicada" sub="motor determinístico" /> },
            { at: 42, x: v ? 0.04 : -0.06, y: v ? 0.84 : 0.84, node: <Check color={ink.green} text="Alçada definida" sub="pronto para formalizar" /> },
          ]}
        />
      </Sequence>
      <Sequence from={CUT.data} durationInFrames={CUT.decide - CUT.data} name="dados">
        <Chapter
          n="02"
          label="DADOS"
          color={ink.sky}
          lines={["Números vivos.", <Grad key="g">Visão completa.</Grad>]}
          sub="Carteira, caixa e resultado no mesmo lugar, atualizados a cada movimento."
          src="proscore/states/home.jpg"
          cam={[{ x: 0, y: 100, vw: 1600 }, { x: 30, y: 280, vw: 1150 }]}
          chips={[
            { at: 20, x: v ? 0.03 : -0.12, y: v ? -0.16 : 0.6, node: <Counter at={24} /> },
            { at: 34, x: v ? 0.55 : 0.66, y: v ? 0.8 : -0.08, node: <Spark at={38} /> },
          ]}
        />
      </Sequence>
      <Sequence from={CUT.decide} durationInFrames={CUT.palm - CUT.decide} name="decisão">
        <Chapter
          n="03"
          label="DECISÃO"
          color={ink.amber}
          lines={["Um clique.", <Grad key="g" to={ink.amber}>Decidido.</Grad>]}
          sub="Cada decisão chega com contexto, alçada e trilha de auditoria."
          src="proscore/states/home.jpg"
          cam={[{ x: 20, y: 560, vw: 1150 }, { x: 140, y: 640, vw: 920 }]}
          click={{ at: 52, x: 733, y: 838 }}
          marks={[{ at: 52, x: 688, y: 819, w: 91, h: 38 }]}
          chips={[{ at: 60, x: v ? 0.42 : 0.5, y: v ? -0.14 : 0.78, accent: ink.green, node: <Check color={ink.green} text="Decisão registrada" sub="trilha de auditoria" /> }]}
        />
      </Sequence>
      <Sequence from={CUT.palm} durationInFrames={CUT.glance - CUT.palm} name="100% responsivo">
        <Responsive />
      </Sequence>
      <Sequence from={CUT.glance} durationInFrames={CUT.finale - CUT.glance} name="um só olhar">
        <Glance />
      </Sequence>
      <Sequence from={CUT.finale} name="assinatura">
        <Finale />
      </Sequence>
      {music ? <Audio src={staticFile("novo/music.mp3")} volume={f => interpolate(f, [NOVO_FRAMES - 36, NOVO_FRAMES], [1, 0], clamp)} /> : null}
    </AbsoluteFill>
  );
};
