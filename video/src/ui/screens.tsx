import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { Cursor } from "../components/Cursor";
import { Highlight } from "../components/Highlight";
import { Button, Card, Check, Kpi, Label, Pill } from "./Kit";

// Telas da área útil da janela (1136 × 600). Posições absolutas para os destaques caírem
// exatamente sobre os blocos que a legenda descreve.

// Devolve uma função de entrada (aparece e sobe levemente) presa ao frame atual.
const useAppear = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (at: number, dur = 0.45) => ({
    opacity: interpolate(frame, [at * fps, (at + dur) * fps], [0, 1], clamp),
    translate: interpolate(frame, [at * fps, (at + dur) * fps], ["0px 14px", "0px 0px"], { ...clamp, easing: ease.out }),
  });
};

const Abs: React.FC<{ x: number; y: number; w: number; h?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x,
  y,
  w,
  h,
  children,
  style,
}) => <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...style }}>{children}</div>;

// 1 · Abertura do dia
export const DayOpeningScreen: React.FC = () => {
  const appear = useAppear();
  const agenda = [
    ["01", "2 operações aguardam decisão", "R$ 5,04 mi dependem de análise ou alçada", colors.alert],
    ["02", "2 operações prontas para avançar", "Formalização ou liberação podem ser concluídas agora", colors.decide],
    ["03", "9 títulos vencidos", "R$ 452,35 mil pedem cobrança, negociação ou recompra", colors.warn],
    ["04", "2 operações fora do ritmo", "Tempo atual acima do padrão histórico do cliente", colors.inkFaint],
  ];
  return (
    <>
      <Abs x={0} y={0} w={760}>
        <Label>Visão consolidada</Label>
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 8 }}>Bom dia, Henrique.</div>
        <div style={{ fontSize: 17, color: colors.inkSoft, marginTop: 6 }}>
          Seu dia começa com <b style={{ color: colors.ink }}>15 itens que merecem atenção</b>, organizados por impacto.
        </div>
      </Abs>
      <Abs x={900} y={6} w={236}>
        <Card style={{ padding: "12px 16px" }}>
          <Label>Seu perfil</Label>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>Administrador</div>
          <div style={{ fontSize: 13, color: colors.inkFaint }}>Diretoria</div>
        </Card>
      </Abs>
      <Abs x={0} y={132} w={1136} style={{ display: "flex", gap: 14 }}>
        <Kpi label="Prioridades" value="15" hint="itens para hoje" />
        <Kpi label="Carteira" value="R$ 1,16 mi" hint="9 títulos vencidos" />
        <Kpi label="Vencido" value="R$ 452,35 mil" hint="posição atual" />
        <Kpi label="Meta do mês" value="35%" hint="R$ 209,26 mil realizados" tone={colors.warn} />
      </Abs>
      <Abs x={0} y={258} w={740} h={342}>
        <Card style={{ height: "100%", boxSizing: "border-box" }}>
          <Label>Agenda inteligente</Label>
          <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 10px" }}>O que pede sua atenção</div>
          {agenda.map(([n, t, d, c], i) => (
            <div
              key={n}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: `1px solid ${colors.line}`, ...appear(0.5 + i * 0.12) }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${c}22`, color: c, fontWeight: 800, fontSize: 13, display: "grid", placeItems: "center" }}>
                {n}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t}</div>
                <div style={{ fontSize: 13, color: colors.inkFaint }}>{d}</div>
              </div>
            </div>
          ))}
        </Card>
      </Abs>
      <Abs x={756} y={258} w={380} h={342}>
        <Card style={{ height: "100%", boxSizing: "border-box" }}>
          <Label>Ritmo de receita</Label>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>R$ 390,74 mil para a meta</div>
          <div style={{ fontSize: 14, color: colors.inkSoft, marginTop: 8, lineHeight: 1.4 }}>
            Meta de R$ 600 mil. O ritmo necessário agora é de R$ 30,06 mil por dia útil.
          </div>
          <MeterBar at={0.9} value={0.35} />
        </Card>
      </Abs>
      <Highlight x={-8} y={124} w={1152} h={112} delay={1.1} end={2.9} />
      <Highlight x={-8} y={250} w={756} h={358} delay={3.0} />
    </>
  );
};

const MeterBar: React.FC<{ at: number; value: number }> = ({ at, value }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, (at + 1.2) * fps], [0, value], { ...clamp, easing: ease.out });
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ height: 10, borderRadius: 5, background: colors.line, overflow: "hidden" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: `linear-gradient(90deg, ${colors.navy800}, ${colors.accentStrong})` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.inkFaint, marginTop: 8 }}>
        <span>R$ 209,26 mil</span>
        <b style={{ color: colors.ink }}>{Math.round(p * 100)}%</b>
        <span>R$ 600 mil</span>
      </div>
    </div>
  );
};

// 2 · Esteira de operações
export const PipelineScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stages = [
    ["Entrada", 3],
    ["Risco", 2],
    ["Lastro", 1],
    ["Preço", 1],
    ["Aprovação", 0],
    ["Liberação", 1],
  ] as const;
  const colW = 1136 / stages.length;
  const travel = interpolate(frame, [1.2 * fps, 4.2 * fps], [0, stages.length - 1], { ...clamp, easing: ease.inOut });
  return (
    <>
      <Abs x={0} y={0} w={900}>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>Operações em andamento</div>
        <div style={{ fontSize: 15, color: colors.inkFaint, marginTop: 4 }}>Central operacional · consolidado · 3 empresas</div>
      </Abs>
      <Abs x={936} y={6} w={200}>
        <Button primary style={{ background: colors.accentStrong, width: "100%", boxSizing: "border-box" }}>
          + Nova operação
        </Button>
      </Abs>
      <Abs x={0} y={80} w={1136} style={{ display: "flex", gap: 14 }}>
        <Kpi label="Volume originado" value="R$ 6.419.689" hint="no mês" />
        <Kpi label="Receita" value="R$ 209.259" hint="realizada" />
        <Kpi label="Taxa média" value="2,24% a.m." hint="ponderada" />
        <Kpi label="Prontas p/ liberar" value="R$ 812.450" hint="2 operações" tone={colors.decide} />
      </Abs>
      <Abs x={0} y={208} w={1136} h={190}>
        <Card style={{ height: "100%", boxSizing: "border-box", position: "relative" }}>
          <Label>Esteira · 6 etapas</Label>
          <div style={{ position: "absolute", left: colW / 2, right: colW / 2, top: 92, height: 4, borderRadius: 2, background: colors.line }} />
          <div
            style={{
              position: "absolute",
              left: colW / 2,
              width: travel * colW,
              top: 92,
              height: 4,
              borderRadius: 2,
              background: colors.accentStrong,
            }}
          />
          {stages.map(([name, count], i) => {
            const reached = travel >= i - 0.05;
            return (
              <div key={name} style={{ position: "absolute", left: i * colW, width: colW, top: 76, textAlign: "center" }}>
                <div
                  style={{
                    margin: "0 auto",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: reached ? colors.accentStrong : colors.white,
                    border: `3px solid ${reached ? colors.accentStrong : colors.line}`,
                    color: reached ? colors.white : colors.inkFaint,
                    fontWeight: 800,
                    fontSize: 15,
                    display: "grid",
                    placeItems: "center",
                    boxSizing: "border-box",
                  }}
                >
                  {count}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginTop: 10 }}>{name}</div>
              </div>
            );
          })}
        </Card>
      </Abs>
      <Abs x={0} y={414} w={1136} style={{ display: "flex", gap: 14 }}>
        <Kpi label="Tempo de ciclo" value="10h39min" hint="da entrada à liberação" tone={colors.alert} />
        <Kpi label="Sem intervenção" value="50,0%" hint="automatizadas" />
        <Kpi label="Exceções decididas" value="0" hint="aguardando alçada" />
        <Kpi label="Regras avaliadas" value="128" hint="hoje" />
      </Abs>
      <Highlight x={-8} y={200} w={1152} h={206} delay={0.9} />
    </>
  );
};

const STEPS = [
  ["Arquivos recebidos", "3 arquivos identificados e preservados para análise"],
  ["Validando formatos", "XML NF-e, CNAB 400 e XLS no layout padrão reconhecidos"],
  ["Extraindo títulos", "9 títulos de 5 sacados; campos ausentes viram pendência"],
  ["Aplicando política e calculando", "Política Mesa padrão v3.2 · exposição e histórico do cedente"],
  ["Análise concluída", "1 impedimento e 1 ponto de alçada encontrados"],
];

const Checklist: React.FC<{ times: number[]; stopAt?: number }> = ({ times, stopAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      {STEPS.map(([title, detail], i) => {
        const doneAt = times[i];
        const blocked = stopAt !== undefined && i >= stopAt;
        const state = !blocked && t >= doneAt ? "done" : (i === 0 || t >= times[i - 1]) && (!blocked || i === stopAt) ? "running" : "todo";
        return (
          <div key={title} style={{ display: "flex", gap: 14, padding: "11px 0", opacity: state === "todo" ? 0.45 : 1 }}>
            <Check state={state} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{title}</div>
              <div style={{ fontSize: 14, color: colors.inkFaint, marginTop: 2 }}>{detail}</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

const CopilotHeader: React.FC = () => (
  <Abs x={0} y={0} w={1136}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <Label color={colors.accentStrong}>Strato Intelligence</Label>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>Copiloto operacional</div>
      </div>
      <Pill bg="#E0E7FF" fg={colors.navy800}>
        IA sugere · cálculos e alçadas determinísticos
      </Pill>
    </div>
  </Abs>
);

// 3 · Copiloto confere o lote
export const BatchScreen: React.FC = () => {
  const appear = useAppear();
  const files = [
    ["XML", "lote_nfe_outubro.xml", "NF-e · 9 duplicatas"],
    ["CNAB", "remessa_cnab400.rem", "CNAB 400"],
    ["XLS", "extrato_padrao.xlsx", "layout padrão"],
  ];
  return (
    <>
      <CopilotHeader />
      <Abs x={0} y={84} w={440} h={516}>
        <Card style={{ height: "100%", boxSizing: "border-box" }}>
          <Label>Arquivos do lote</Label>
          {files.map(([kind, name, hint], i) => (
            <div
              key={name}
              style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${colors.line}`, ...appear(0.3 + i * 0.25) }}
            >
              <div style={{ width: 52, padding: "6px 0", textAlign: "center", borderRadius: 8, background: colors.ink, color: colors.white, fontSize: 12, fontWeight: 800 }}>
                {kind}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                <div style={{ fontSize: 13, color: colors.inkFaint }}>{hint}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 22, ...appear(1.1) }}>
            <Button primary style={{ width: "100%", boxSizing: "border-box" }}>
              Analisar lote
            </Button>
          </div>
        </Card>
      </Abs>
      <Abs x={460} y={84} w={676} h={516}>
        <Card style={{ height: "100%", boxSizing: "border-box" }}>
          <Label>Conferência em andamento</Label>
          <Checklist times={[1.6, 2.3, 3.0, 3.8, 4.5]} />
        </Card>
      </Abs>
      <Highlight x={452} y={76} w={692} h={532} delay={1.5} />
    </>
  );
};

// 4 · Decisão humana: o Copiloto para e pede autorização
export const ApprovalScreen: React.FC = () => {
  const appear = useAppear();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clicked = frame >= 3.1 * fps;
  const accent = clicked ? colors.decide : colors.warn;
  return (
    <>
      <CopilotHeader />
      <Abs x={0} y={84} w={560} h={516}>
        <Card style={{ height: "100%", boxSizing: "border-box" }}>
          <Label>Conferência em andamento</Label>
          <Checklist times={[0, 0, 0, clicked ? 4.0 : 99, clicked ? 4.6 : 99]} stopAt={clicked ? undefined : 3} />
        </Card>
      </Abs>
      <Abs x={580} y={150} w={556}>
        <div
          style={{
            ...appear(0.6),
            borderRadius: 18,
            padding: 26,
            background: clicked ? "#ECFDF5" : "#FFF7ED",
            border: `2px solid ${accent}`,
            boxShadow: `0 0 0 6px ${accent}22`,
          }}
        >
          <Label color={accent}>{clicked ? "Autorizado" : "Preciso da sua autorização"}</Label>
          <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.3, marginTop: 10 }}>
            {clicked
              ? "Consulta ao birô autorizada por Henrique."
              : "Mercantil Boa Vista é um sacado novo e a política pede consulta ao birô antes de aprovar."}
          </div>
          <div style={{ fontSize: 15, color: colors.inkSoft, marginTop: 10 }}>
            {clicked ? "Registrado na trilha da operação · 10:42" : "Nenhuma consulta externa sai sem decisão humana."}
          </div>
          {clicked ? null : (
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <Button primary>Autorizar consulta</Button>
              <Button>Seguir sem consultar</Button>
            </div>
          )}
        </div>
      </Abs>
      <Cursor from={[1060, 560]} to={[690, 378]} start={1.6} click={3.0} />
    </>
  );
};

// 5 · Duplicata encontrada antes da aprovação
export const DuplicateScreen: React.FC = () => {
  const appear = useAppear();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const score = Math.round(interpolate(frame, [0.8 * fps, 2.4 * fps], [0, 904], { ...clamp, easing: ease.out }));
  const bars = [
    ["Valor de face", "R$ 97.830,00", 1, colors.ink],
    ["Deságio", "−R$ 4.234,89", 0.05, colors.alert],
    ["Tarifas", "−R$ 222,00", 0.02, colors.alert],
    ["IOF", "−R$ 526,41", 0.03, colors.alert],
    ["Líquido ao cedente", "R$ 92.846,70", 0.95, colors.decide],
  ] as const;
  return (
    <>
      <Abs x={0} y={0} w={1136}>
        <Label>Resumo da operação · Política Mesa padrão v3.2</Label>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <div style={{ fontSize: 34, fontWeight: 700 }}>GZ Transportes Ltda</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: colors.inkFaint }}>Líquido ao cedente</div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>R$ 92.846,70</div>
          </div>
        </div>
      </Abs>
      <Abs x={0} y={96} w={1136}>
        <div style={{ ...appear(1.0), padding: "16px 20px", borderRadius: 14, background: "#FEF2F2", border: `2px solid ${colors.alert}` }}>
          <div style={{ fontWeight: 800, color: "#B91C1C", fontSize: 18 }}>Aprovação bloqueada</div>
          <div style={{ fontSize: 15, color: colors.inkSoft, marginTop: 2 }}>NF 1175-3 já está na carteira · cessão duplicada impedida antes da alçada</div>
        </div>
      </Abs>
      <Abs x={0} y={200} w={1136} style={{ display: "flex", gap: 14 }}>
        <Kpi label="Valor de face" value="R$ 97.830,00" hint="9 títulos" />
        <Kpi label="Custo efetivo" value="3,56% a.m." hint="para o cedente" />
        <Kpi label="Prazo médio" value="45 dias" hint="ponderado" />
        <Kpi label="Títulos / sacados" value="9 / 5" hint="no lote" />
      </Abs>
      <Abs x={0} y={322} w={740} h={278}>
        <Card style={{ height: "100%", boxSizing: "border-box" }}>
          <Label>Composição do valor</Label>
          {bars.map(([name, value, w, c], i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
              <div style={{ width: 170, fontSize: 15, color: colors.inkSoft }}>{name}</div>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: colors.line }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 5,
                    background: c,
                    width: `${interpolate(frame, [(0.4 + i * 0.1) * fps, (1.2 + i * 0.1) * fps], [0, Math.max(w, 0.02) * 100], { ...clamp, easing: ease.out })}%`,
                  }}
                />
              </div>
              <div style={{ width: 130, textAlign: "right", fontWeight: 700, fontSize: 15 }}>{value}</div>
            </div>
          ))}
        </Card>
      </Abs>
      <Abs x={756} y={322} w={380} h={278}>
        <Card style={{ height: "100%", boxSizing: "border-box", textAlign: "center" }}>
          <Label>Score do cedente</Label>
          <Gauge value={score / 1000} />
          <div style={{ fontSize: 44, fontWeight: 800, marginTop: -64 }}>{score}</div>
          <div style={{ fontSize: 13, color: colors.inkFaint }}>de 1000 · risco baixo</div>
        </Card>
      </Abs>
      <Highlight x={-8} y={88} w={1152} h={96} delay={1.4} color={colors.alert} />
    </>
  );
};

const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const r = 90;
  const len = Math.PI * r;
  return (
    <svg width="240" height="140" viewBox="0 0 240 140" style={{ marginTop: 14 }}>
      <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke={colors.line} strokeWidth="16" strokeLinecap="round" />
      <path
        d="M30 120 A90 90 0 0 1 210 120"
        fill="none"
        stroke={colors.decide}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${len * value} ${len}`}
      />
    </svg>
  );
};

// 6 · Pergunte ao Copiloto: a resposta vem com a fonte
export const AskScreen: React.FC = () => {
  const appear = useAppear();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const question = "Quais títulos estão vencidos?";
  const typed = question.slice(0, Math.floor(interpolate(frame, [0.3 * fps, 1.3 * fps], [0, question.length], clamp)));
  const rows = [
    ["Hospital Santa Helena S.A.", "Rede Clínica Íntegra", "27/08/2026", "R$ 12.400,00"],
    ["Hospital Santa Helena S.A.", "Rede Clínica Íntegra", "15/09/2026", "R$ 98.100,00"],
    ["Construtora Prado S.A.", "Metalúrgica Vale do Aço", "22/09/2026", "R$ 34.780,00"],
  ];
  return (
    <>
      <CopilotHeader />
      <Abs x={636} y={86} w={500} style={{ textAlign: "right" }}>
        <span style={{ display: "inline-block", padding: "14px 20px", borderRadius: "18px 18px 4px 18px", background: colors.ink, color: colors.white, fontSize: 19, fontWeight: 600 }}>
          {typed}
          <span style={{ opacity: typed.length < question.length ? 1 : 0 }}>|</span>
        </span>
      </Abs>
      <Abs x={0} y={160} w={1136}>
        <Card style={{ ...appear(1.6), padding: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>9 títulos vencidos em 13/10/2026, somando R$ 452.349,25.</div>
          <div style={{ fontSize: 15, color: colors.inkSoft, marginTop: 4 }}>Os maiores primeiro:</div>
          <div style={{ marginTop: 14 }}>
            {[["Sacado", "Cedente", "Vencimento", "Valor"], ...rows].map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.8fr",
                  padding: "10px 0",
                  borderTop: i ? `1px solid ${colors.line}` : "none",
                  fontSize: i ? 16 : 12,
                  fontWeight: i ? 500 : 700,
                  color: i ? colors.ink : colors.inkFaint,
                  textTransform: i ? "none" : "uppercase",
                  letterSpacing: i ? 0 : "0.1em",
                  ...(i ? appear(1.9 + i * 0.15) : {}),
                }}
              >
                {r.map((c, j) => (
                  <div key={j} style={{ textAlign: j === 3 ? "right" : "left", fontWeight: j === 3 && i ? 700 : undefined }}>
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, ...appear(2.6) }}>
            <Pill bg="#E0E7FF" fg={colors.navy800}>
              Fonte: Carteira · posição 13/10/2026
            </Pill>
            <Pill bg={colors.surface} fg={colors.inkSoft}>
              Consulta somente leitura
            </Pill>
          </div>
        </Card>
      </Abs>
      <Highlight x={14} y={510} w={300} h={44} delay={2.9} radius={999} />
    </>
  );
};

// 7 · Carteira e cobrança priorizadas
export const CollectionScreen: React.FC = () => {
  const appear = useAppear();
  const rows = [
    ["Alta", "Hospital Santa Helena S.A.", "Vencido há 47 dias", "R$ 12.400,00", "Ligar hoje"],
    ["Alta", "Construtora Prado S.A.", "Vencido há 32 dias", "R$ 34.780,00", "Negociar"],
    ["Média", "Plano Saúde Regional S.A.", "Vencido há 18 dias", "R$ 76.600,00", "Lembrete"],
    ["Média", "Clínica São Lucas Ltda", "Vencido há 9 dias", "R$ 21.300,00", "Lembrete"],
    ["Baixa", "Empório Central Ltda", "Vence em 2 dias", "R$ 8.940,00", "Aviso"],
  ];
  const tone = (p: string) =>
    p === "Alta" ? ["#FEE2E2", "#B91C1C"] : p === "Média" ? ["#FEF3C7", "#B45309"] : ["#E2E8F0", colors.inkSoft];
  return (
    <>
      <Abs x={0} y={0} w={1136}>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>Carteira · Central de cobrança</div>
        <div style={{ fontSize: 15, color: colors.inkFaint, marginTop: 4 }}>Fila priorizada pelo risco de recuperação, com a régua aplicada a cada título</div>
      </Abs>
      <Abs x={0} y={80} w={1136} style={{ display: "flex", gap: 14 }}>
        <Kpi label="Críticos" value="2" hint="ação hoje" tone={colors.alert} />
        <Kpi label="Agenda hoje" value="9" hint="contatos" />
        <Kpi label="Promessas ativas" value="0" hint="acompanhamento" />
        <Kpi label="Valor em aberto" value="R$ 446.349,25" hint="carteira filtrada" />
      </Abs>
      <Abs x={0} y={204} w={1136} h={396}>
        <Card style={{ height: "100%", boxSizing: "border-box", padding: "10px 20px" }}>
          {rows.map(([p, name, status, value, action], i) => {
            const [bg, fg] = tone(p);
            return (
              <div
                key={name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1.6fr 1fr 0.8fr 130px",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 0",
                  borderTop: i ? `1px solid ${colors.line}` : "none",
                  ...appear(0.4 + i * 0.14),
                }}
              >
                <div>
                  <Pill bg={bg} fg={fg}>
                    {p}
                  </Pill>
                </div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{name}</div>
                <div style={{ fontSize: 15, color: colors.inkSoft }}>{status}</div>
                <div style={{ fontWeight: 700, fontSize: 16, textAlign: "right" }}>{value}</div>
                <div style={{ textAlign: "right" }}>
                  <Button style={{ padding: "8px 14px", fontSize: 13 }}>{action}</Button>
                </div>
              </div>
            );
          })}
        </Card>
      </Abs>
      <Highlight x={-8} y={196} w={1152} h={150} delay={1.5} />
    </>
  );
};
