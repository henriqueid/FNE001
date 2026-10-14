/** Cenas de uso do STRATO: telas do sistema animadas, desenhadas com 960 px de largura. */
import React from "react";
import { Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import {
  Button,
  Card,
  Chip,
  Clickable,
  CopilotPanel,
  CountUp,
  FadeUp,
  Label,
  ProgressBar,
  ReplyAuthor,
  Tile,
  Typewriter,
  UserBubble,
  brl,
} from "../components";
import { theme } from "../theme";
import { ProductStage } from "./layout";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Som de clique sincronizado com o cursor. */
export function ClickSound({ at }: { at: number }) {
  return (
    <Sequence from={at} durationInFrames={10} layout="none">
      <Audio src={staticFile("missao/click.wav")} volume={0.7} />
    </Sequence>
  );
}

/** Janela do app: barra com a marca e o caminho da tela. */
function AppWindow({ path, children, right }: { path: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        width: 960,
        borderRadius: 30,
        overflow: "hidden",
        background: "#fff",
        border: `1px solid ${theme.borderStrong}`,
        boxShadow: theme.shadowPanel,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 24px",
          background: theme.headGradient,
          color: "#fff",
        }}
      >
        <Tile size={36} />
        <span style={{ fontSize: 15, letterSpacing: 2.4, fontWeight: 800, color: theme.kicker }}>STRATO</span>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{path}</span>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      <div style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18, background: `linear-gradient(180deg, ${theme.surface}, #fff 180px)` }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 · Entrada: arquivos → títulos validados                           */
/* ------------------------------------------------------------------ */

const TITLES = [
  { doc: "NF 1187-1", debtor: "Rede Mercantil Nacional", value: 15500, status: "ok" },
  { doc: "NF 1187-2", debtor: "Rede Mercantil Nacional", value: 12500, status: "ok" },
  { doc: "NF 1192-1", debtor: "Supermercado Haag", value: 9750, status: "ok" },
  { doc: "NF 1175-3", debtor: "Supermercado Haag", value: 6200, status: "dup" },
  { doc: "DM 5531", debtor: "Comercial Oeste", value: 11700, status: "ok" },
  { doc: "PC 91-1", debtor: "Mercantil Boa Vista", value: 14500, status: "new" },
] as const;

export function EntradaScene() {
  const frame = useCurrentFrame();
  const files = [
    ["XML", "lote_nfe_outubro.xml"],
    ["CNAB", "remessa_cnab400.rem"],
    ["XLS", "extrato_padrao.xlsx"],
  ];
  const READ = 62;
  const rowsFrom = READ + 26;
  const reading = interpolate(frame, [READ, rowsFrom], [0, 100], clamp);
  const ready = Math.min(7, Math.max(0, Math.floor((frame - rowsFrom) / 12)));
  return (
    <ProductStage kicker="ENTRADA" title={<>Envie o lote.<br />O STRATO faz o resto.</>}>
      <AppWindow path="Nova operação · Distribuidora Aurora" right={<Chip tone="blue">9 títulos</Chip>}>
        <div
          style={{
            position: "relative",
            height: 120,
            borderRadius: 20,
            border: `2px dashed ${frame < READ ? theme.blueLight : theme.border}`,
            background: frame < READ ? "rgb(96 165 250 / 8%)" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          {frame < READ ? (
            files.map(([fmt, name], i) => {
              const p = spring({ frame: frame - 6 - i * 10, fps: 30, config: { damping: 14 } });
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: "#fff",
                    boxShadow: theme.shadowSoft,
                    border: `1px solid ${theme.border}`,
                    opacity: p,
                    transform: `translateY(${(1 - p) * -120}px) rotate(${(1 - p) * (i - 1) * 8}deg)`,
                  }}
                >
                  <Tile size={40}>
                    <span style={{ fontSize: 12, fontWeight: 800 }}>{fmt}</span>
                  </Tile>
                  <b style={{ fontSize: 17, color: theme.slate }}>{name}</b>
                </div>
              );
            })
          ) : (
            <div style={{ width: "86%", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, fontWeight: 700, color: theme.slate }}>
                <span>{reading < 100 ? "Lendo e validando 3 arquivos…" : "3 arquivos lidos · 9 títulos extraídos"}</span>
                <span>{Math.round(reading)}%</span>
              </div>
              <ProgressBar value={reading} />
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1.1fr 1.3fr", padding: "0 6px" }}>
          {["TÍTULO", "SACADO", "VALOR", "SITUAÇÃO"].map(h => (
            <Label key={h} style={{ fontSize: 14 }}>
              {h}
            </Label>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 6 * 54 }}>
          {TITLES.map((t, i) => {
            const at = rowsFrom + i * 10;
            if (frame < at) return null;
            const p = spring({ frame: frame - at, fps: 30, config: { damping: 18 } });
            const chip =
              t.status === "dup" ? (
                <Chip tone="bad">Duplicado</Chip>
              ) : t.status === "new" ? (
                <Chip tone="warn">Sacado novo</Chip>
              ) : (
                <Chip tone="good">✓ Validado</Chip>
              );
            return (
              <div
                key={t.doc}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr 1.1fr 1.3fr",
                  alignItems: "center",
                  padding: "10px 6px",
                  borderRadius: 14,
                  background: t.status === "dup" ? "rgb(220 38 38 / 5%)" : "#fff",
                  border: `1px solid ${theme.border}`,
                  fontSize: 19,
                  color: theme.slate,
                  opacity: p,
                  transform: `translateX(${(1 - p) * 40}px)`,
                }}
              >
                <b style={{ paddingLeft: 10 }}>{t.doc}</b>
                <span>{t.debtor}</span>
                <span>{brl(t.value)}</span>
                <span>{chip}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            ["Prontos", ready, theme.good],
            ["Atenção", frame >= rowsFrom + 50 ? 1 : 0, theme.warning],
            ["Bloqueados", frame >= rowsFrom + 30 ? 1 : 0, theme.critical],
          ].map(([label, value, color]) => (
            <Card key={label as string} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <i style={{ width: 12, height: 12, borderRadius: 99, background: color as string }} />
              <span style={{ fontSize: 19, color: theme.text3, fontWeight: 700 }}>{label}</span>
              <b style={{ marginLeft: "auto", fontSize: 30, color: theme.slate }}>{value}</b>
            </Card>
          ))}
        </div>
      </AppWindow>
    </ProductStage>
  );
}

/* ------------------------------------------------------------------ */
/* 6 · Esteira: seis etapas numa área de trabalho                      */
/* ------------------------------------------------------------------ */

const STEPS = [
  { name: "Entrada", detail: "9 títulos importados de 3 arquivos", metric: "9/9" },
  { name: "Risco", detail: "Score do cedente 742 · limite disponível R$ 412 mil", metric: "742" },
  { name: "Lastro", detail: "NF-e autorizadas na SEFAZ e manifestação do sacado", metric: "9/9" },
  { name: "Preço", detail: "Taxa 2,6% a.m. · deságio e tarifas pelo motor", metric: "2,6%" },
  { name: "Aprovação", detail: "Dentro da alçada da Mesa · aprovação registrada", metric: "Mesa" },
  { name: "Liberação", detail: "Pix agendado para a janela das 14h", metric: "14:00" },
];

export function EsteiraScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const stepLen = Math.max(28, Math.floor((duration - 50) / STEPS.length));
  const progress = interpolate(frame, [16, 16 + stepLen * STEPS.length], [0, STEPS.length], clamp);
  const current = Math.min(STEPS.length - 1, Math.floor(progress));
  const automation = Math.round(interpolate(progress, [0, STEPS.length], [12, 94], clamp));
  return (
    <ProductStage kicker="ÁREA DE TRABALHO" title={<>Uma operação.<br />Seis etapas.<br />Uma só tela.</>}>
      <AppWindow path="Operação 20261014001" right={<Chip tone="good">Automação {automation}%</Chip>}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Label style={{ fontSize: 14 }}>DISTRIBUIDORA AURORA · ADITIVO 20261014001</Label>
            <div style={{ fontSize: 40, fontWeight: 800, color: theme.slate, letterSpacing: -1 }}>R$ 79.130</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Label style={{ fontSize: 14 }}>LÍQUIDO</Label>
            <div style={{ fontSize: 40, fontWeight: 800, color: theme.good, letterSpacing: -1 }}>R$ 75.838</div>
          </div>
        </div>
        {/* Esteira */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", padding: "10px 0" }}>
          <div style={{ position: "absolute", left: "8%", right: "8%", top: 36, height: 4, background: theme.surface3, borderRadius: 99 }} />
          <div
            style={{
              position: "absolute",
              left: "8%",
              top: 36,
              height: 4,
              width: `${(Math.min(progress, STEPS.length - 1) / (STEPS.length - 1)) * 84}%`,
              background: theme.progressGradient,
              borderRadius: 99,
            }}
          />
          {STEPS.map((s, i) => {
            const done = progress >= i + 1;
            const active = i === current && !done;
            return (
              <div key={s.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 22,
                    fontWeight: 900,
                    color: done || active ? "#fff" : theme.text3,
                    background: done ? theme.good : active ? theme.tileGradient : "#fff",
                    border: done || active ? "none" : `2px solid ${theme.border}`,
                    boxShadow: active ? "0 0 0 6px rgb(37 99 235 / 15%)" : "none",
                    transform: `scale(${active ? 1.08 : 1})`,
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: active ? theme.blueDeep : theme.slate }}>{s.name}</span>
              </div>
            );
          })}
        </div>
        {/* Detalhe da etapa atual */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((s, i) => {
            const visible = progress >= i;
            if (!visible) return null;
            const done = progress >= i + 1;
            const p = spring({ frame: frame - 16 - i * stepLen, fps: 30, config: { damping: 18 } });
            return (
              <div
                key={s.name}
                style={{
                  display: i < current - 2 ? "none" : "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  borderRadius: 16,
                  background: "#fff",
                  border: `1px solid ${done ? theme.border : theme.blueLight}`,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px)`,
                }}
              >
                <span style={{ fontSize: 20, color: done ? theme.good : theme.blue, fontWeight: 900, width: 26 }}>
                  {done ? "✓" : "●"}
                </span>
                <b style={{ fontSize: 20, color: theme.slate, width: 130 }}>{s.name}</b>
                <span style={{ flex: 1, fontSize: 19, color: theme.text2 }}>{s.detail}</span>
                <Chip tone={done ? "good" : "blue"}>{s.metric}</Chip>
              </div>
            );
          })}
        </div>
      </AppWindow>
    </ProductStage>
  );
}

/* ------------------------------------------------------------------ */
/* 7 · Exceção: regra, valor observado, recomendação, um clique        */
/* ------------------------------------------------------------------ */

export function ExcecaoScene({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const CLICK = Math.round(duration * 0.5);
  const applied = frame >= CLICK;
  const t = interpolate(frame, [CLICK + 4, CLICK + 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const conc = 36.8 + (29.7 - 36.8) * t;
  const ok = conc <= 30;
  const limitPct = 30 / 45;
  return (
    <ProductStage kicker="GESTÃO POR EXCEÇÃO" title={<>Só as exceções<br />chegam até você.</>}>
      <AppWindow path="Exceção · Concentração de sacado" right={applied && t > 0.95 ? <Chip tone="good">Resolvida</Chip> : <Chip tone="warn">1 exceção</Chip>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Card>
            <Label style={{ fontSize: 14 }}>REGRA</Label>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.slate, marginTop: 4 }}>Concentração máxima por sacado</div>
            <div style={{ fontSize: 17, color: theme.text3 }}>Política Mesa padrão · versão 3.2</div>
          </Card>
          <Card>
            <Label style={{ fontSize: 14 }}>EVIDÊNCIA</Label>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.slate, marginTop: 4 }}>Rede Mercantil Nacional</div>
            <div style={{ fontSize: 17, color: theme.text3 }}>3 títulos · R$ 36.000 neste lote</div>
          </Card>
        </div>
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <Label style={{ fontSize: 14 }}>VALOR OBSERVADO</Label>
              <div style={{ fontSize: 56, fontWeight: 800, color: ok ? theme.good : theme.warning, letterSpacing: -1.5 }}>
                {conc.toFixed(1).replace(".", ",")}%
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <Label style={{ fontSize: 14 }}>LIMITE</Label>
              <div style={{ fontSize: 40, fontWeight: 800, color: theme.slate }}>30,0%</div>
            </div>
          </div>
          <div style={{ position: "relative", height: 18, borderRadius: 99, background: theme.surface3 }}>
            <div
              style={{
                width: `${(conc / 45) * 100}%`,
                height: "100%",
                borderRadius: 99,
                background: ok ? theme.good : `linear-gradient(90deg, ${theme.warning}, #f59e0b)`,
              }}
            />
            <div style={{ position: "absolute", left: `${limitPct * 100}%`, top: -8, bottom: -8, width: 3, background: theme.slate }} />
          </div>
        </Card>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 18px",
            borderRadius: 20,
            background: applied ? theme.goodSoft : "rgb(37 99 235 / 7%)",
            border: `1px solid ${applied ? "rgb(22 134 92 / 30%)" : "rgb(37 99 235 / 25%)"}`,
          }}
        >
          <Tile size={44} />
          <div style={{ flex: 1 }}>
            <Label style={{ fontSize: 13, color: theme.blueDeep }}>RECOMENDAÇÃO</Label>
            <div style={{ fontSize: 21, fontWeight: 700, color: theme.slate }}>
              Retirar NF 1187-2 (R$ 12.500) leva a concentração a 29,7%
            </div>
          </div>
          <Clickable clickAt={CLICK} fromX={-260} fromY={-180}>
            <Button tone={applied ? "good" : "blue"} pressAt={CLICK}>
              {applied ? "Aplicada ✓" : "Aplicar recomendação"}
            </Button>
          </Clickable>
        </div>
        <ClickSound at={CLICK} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            ["Títulos", applied ? Math.round(9 - 2 * t).toString() : "9"],
            ["Líquido", brl(93353 + (75838 - 93353) * t)],
            ["Situação", applied && t > 0.95 ? "Pronta p/ aprovar" : "Em exceção"],
          ].map(([k, v], i) => (
            <Card key={k} style={{ padding: "14px 18px" }}>
              <Label style={{ fontSize: 13 }}>{k.toUpperCase()}</Label>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: i === 2 ? (applied && t > 0.95 ? theme.good : theme.warning) : theme.slate,
                }}
              >
                {v}
              </div>
            </Card>
          ))}
        </div>
      </AppWindow>
    </ProductStage>
  );
}

/* ------------------------------------------------------------------ */
/* 8 · Copiloto                                                        */
/* ------------------------------------------------------------------ */

export function CopilotoScene() {
  return (
    <ProductStage kicker="COPILOTO" title={<>Um copiloto<br />para o seu dia.</>}>
      <CopilotPanel width={960} status="Pronto para ajudar">
        <FadeUp delay={4}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 16px",
              borderRadius: 18,
              border: "1px solid rgb(17 24 39 / 16%)",
              background: "#fff",
            }}
          >
            <Tile size={44} />
            <div style={{ flex: 1 }}>
              <Label style={{ fontSize: 13 }}>SEU DIA · ATUALIZADO AGORA</Label>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.slate }}>4 tarefas pedem sua atenção</div>
            </div>
            <b style={{ fontSize: 28, color: theme.slate }}>72%</b>
            <span style={{ fontSize: 16, color: theme.text3 }}>da meta</span>
          </div>
        </FadeUp>
        <UserBubble delay={24}>
          <Typewriter text="Qual o risco da carteira hoje?" start={28} speed={1.3} />
        </UserBubble>
        <FadeUp delay={70}>
          <Card style={{ display: "flex", flexDirection: "column", gap: 14, borderRadius: "24px 24px 24px 8px" }}>
            <ReplyAuthor>Consulta à carteira</ReplyAuthor>
            <div style={{ fontSize: 23, color: theme.slate, lineHeight: 1.45 }}>
              Carteira de <b>R$ 4,8 mi</b> com <b style={{ color: theme.critical }}>3,9% vencidos</b>. O maior risco é a
              concentração em <b>Rede Mercantil</b>, que está em <b>27%</b>, perto do limite de 30%.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                ["Vencidos", <CountUp key="v" to={186420} start={80} format={brl} />],
                ["Maior sacado", "27%"],
                ["Score médio", <CountUp key="s" to={718} start={84} />],
              ].map(([k, v]) => (
                <div key={k as string} style={{ background: theme.surface, borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ fontSize: 15, color: theme.text3, fontWeight: 700 }}>{k}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: theme.slate }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Chip tone="blue">Fonte: Carteira · Política v3.2</Chip>
              <Chip>Abrir Central do Dia →</Chip>
            </div>
          </Card>
        </FadeUp>
      </CopilotPanel>
    </ProductStage>
  );
}

/* ------------------------------------------------------------------ */
/* 9 · Carteira, caixa e conciliação                                   */
/* ------------------------------------------------------------------ */

export function CarteiraScene() {
  const frame = useCurrentFrame();
  const bars = [62, 48, 75, 54, 88, 66, 92, 58, 80, 70];
  const outs = [30, 42, 26, 50, 34, 40, 28, 44, 36, 31];
  const recon = [
    ["Pix recebido · Supermercado Haag", "R$ 9.750"],
    ["Boleto liquidado · Comercial Oeste", "R$ 11.700"],
    ["TED · Cooperativa Vale Verde", "R$ 7.880"],
  ];
  return (
    <ProductStage kicker="CARTEIRA E CAIXA" title={<>Tudo conectado,<br />em tempo real.</>}>
      <AppWindow path="Visão geral" right={<Chip tone="good">● Ao vivo</Chip>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            ["Carteira em aberto", <CountUp key="a" to={4.8} start={6} format={v => `R$ ${v.toFixed(1).replace(".", ",")} mi`} />, theme.slate],
            ["Caixa disponível", <CountUp key="b" to={1.2} start={10} format={v => `R$ ${v.toFixed(1).replace(".", ",")} mi`} />, theme.good],
            ["Vencidos", <CountUp key="c" to={3.9} start={14} format={v => `${v.toFixed(1).replace(".", ",")}%`} />, theme.critical],
          ].map(([k, v, c]) => (
            <Card key={k as string} style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 16, color: theme.text3, fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: c as string, letterSpacing: -0.8 }}>{v}</div>
            </Card>
          ))}
        </div>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <b style={{ fontSize: 20, color: theme.slate }}>Fluxo de caixa · próximos 30 dias</b>
            <div style={{ display: "flex", gap: 14, fontSize: 15, color: theme.text3 }}>
              <span>
                <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: theme.ink, marginRight: 6 }} />
                Entradas
              </span>
              <span>
                <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: theme.blueLight, marginRight: 6 }} />
                Saídas
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 190 }}>
            {bars.map((b, i) => {
              const g = interpolate(frame, [16 + i * 4, 40 + i * 4], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
              return (
                <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4, height: "100%" }}>
                  <div style={{ flex: 1, height: `${b * g}%`, background: theme.ink, borderRadius: "6px 6px 2px 2px" }} />
                  <div style={{ flex: 1, height: `${outs[i] * g}%`, background: theme.blueLight, borderRadius: "6px 6px 2px 2px" }} />
                </div>
              );
            })}
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label style={{ fontSize: 14 }}>CONCILIAÇÃO AUTOMÁTICA · EXTRATO BANCÁRIO</Label>
          {recon.map(([k, v], i) => {
            const at = 70 + i * 16;
            const done = frame >= at + 10;
            return (
              <FadeUp key={k} delay={at} distance={10}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 16px",
                    borderRadius: 14,
                    background: "#fff",
                    border: `1px solid ${theme.border}`,
                    fontSize: 19,
                  }}
                >
                  <span style={{ flex: 1, color: theme.slate, fontWeight: 600 }}>{k}</span>
                  <b style={{ color: theme.slate }}>{v}</b>
                  {done ? <Chip tone="good">✓ Conciliado</Chip> : <Chip tone="blue">Conferindo…</Chip>}
                </div>
              </FadeUp>
            );
          })}
        </div>
      </AppWindow>
    </ProductStage>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · Trilha de decisões                                             */
/* ------------------------------------------------------------------ */

export function TrilhaScene() {
  const events = [
    ["08:42", "Lote importado e validado", "Sistema", "a91f…3c"],
    ["08:47", "Exceção de concentração resolvida", "Ana Souza · Mesa", "7d20…9e"],
    ["08:49", "Preço calculado · política v3.2", "Motor de preço", "c4b8…01"],
    ["09:05", "Aprovada com justificativa", "Diretoria de crédito", "e13a…5f"],
    ["14:00", "Pix liberado e conciliado", "Financeiro", "0b77…d2"],
  ];
  return (
    <ProductStage kicker="TRILHA DE DECISÃO" title={<>Cada decisão,<br />registrada.</>}>
      <AppWindow path="Trilha · Operação 20261014001" right={<Chip tone="blue">🔒 Imutável</Chip>}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "absolute", left: 21, top: 20, bottom: 20, width: 2, background: theme.border }} />
          {events.map(([time, what, who, hash], i) => (
            <FadeUp key={what} delay={8 + i * 14} distance={12}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    flex: "0 0 44px",
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: i === events.length - 1 ? theme.good : theme.tileGradient,
                    color: "#fff",
                    fontWeight: 900,
                    zIndex: 1,
                  }}
                >
                  ✓
                </span>
                <Card style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
                  <span style={{ fontFamily: theme.mono, fontSize: 18, color: theme.text3 }}>{time}</span>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 21, color: theme.slate }}>{what}</b>
                    <div style={{ fontSize: 17, color: theme.text3 }}>{who}</div>
                  </div>
                  <span style={{ fontFamily: theme.mono, fontSize: 15, color: theme.text3, background: theme.surface, borderRadius: 8, padding: "4px 8px" }}>
                    #{hash}
                  </span>
                </Card>
              </div>
            </FadeUp>
          ))}
        </div>
        <FadeUp delay={90}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 18, color: theme.text3 }}>Quem, quando e com qual política — sem edição ou exclusão.</span>
            <Button tone="ink">Exportar evidências</Button>
          </div>
        </FadeUp>
      </AppWindow>
    </ProductStage>
  );
}
