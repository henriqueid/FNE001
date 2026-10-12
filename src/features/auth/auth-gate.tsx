"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { getStratoTenantId } from "@/src/app/tenant";
import { type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { StratoAuthProvider, type StratoAuthMode } from "./auth-context";
import { CompanyOnboarding } from "@/src/features/onboarding/company-onboarding";
import styles from "./auth-gate.module.css";

const TENANT_ID = getStratoTenantId();
const departments: UserDepartment[] = [
  "Diretoria",
  "Operações",
  "Risco e crédito",
  "Controladoria",
  "Financeiro",
  "Comercial",
  "Cadastro",
];

type GateState =
  | { status: "loading" }
  | { status: "signed-out"; message?: string; tone?: "error" | "success" }
  | { status: "signed-in"; mode: StratoAuthMode };

async function verifyAccess() {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    headers: { "x-strato-tenant-id": TENANT_ID, "x-strato-auth-probe": "1" },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { authenticated?: boolean };
  return body.authenticated === true;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState<UserDepartment>("Operações");
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localDemo, setLocalDemo] = useState(false);

  const resolveSession = useCallback(async () => {
    setGate((await verifyAccess()) ? { status: "signed-in", mode: "internal" } : { status: "signed-out" });
  }, []);

  useEffect(() => {
    const demoTimer = window.setTimeout(
      () => setLocalDemo(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"),
      0,
    );
    const sessionTimer = window.setTimeout(
      () =>
        void resolveSession().catch(() =>
          setGate({ status: "signed-out", message: "Não foi possível validar a sessão.", tone: "error" }),
        ),
      0,
    );
    return () => {
      window.clearTimeout(demoTimer);
      window.clearTimeout(sessionTimer);
    };
  }, [resolveSession]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
    setGate({ status: "signed-out" });
  }, []);

  const context = useMemo(
    () => (gate.status === "signed-in" ? { mode: gate.mode, signOut } : undefined),
    [gate, signOut],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setGate({ status: "signed-out" });
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-strato-tenant-id": TENANT_ID },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setGate({ status: "signed-out", message: body.error ?? "E-mail ou senha inválidos.", tone: "error" });
        return;
      }
      setGate({ status: "signed-in", mode: "internal" });
    } catch {
      setGate({ status: "signed-out", message: "Não foi possível entrar agora. Tente novamente.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const requestAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setGate({ status: "signed-out", message: "As senhas não coincidem.", tone: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/requests", {
        method: "POST",
        headers: { "content-type": "application/json", "x-strato-tenant-id": TENANT_ID },
        body: JSON.stringify({ name, email: email.trim(), password, department }),
      });
      const body = (await response.json()) as { error?: string; message?: string; status?: string };
      if (!response.ok) {
        setGate({
          status: "signed-out",
          message: body.error ?? "Não foi possível enviar a solicitação.",
          tone: "error",
        });
        return;
      }
      if (body.status === "existing") {
        setRegistering(false);
        setConfirmPassword("");
      }
      setGate({ status: "signed-out", message: body.message, tone: "success" });
    } catch {
      setGate({ status: "signed-out", message: "Não foi possível enviar a solicitação agora.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const enterDemo = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-strato-tenant-id": TENANT_ID },
        body: JSON.stringify({ mode: "demo" }),
      });
      if (!response.ok) throw new Error("demo unavailable");
      setGate({ status: "signed-in", mode: "demo" });
    } catch {
      setGate({ status: "signed-out", message: "A demonstração local não pôde ser iniciada.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (gate.status === "signed-in" && context)
    return (
      <StratoAuthProvider value={context}>
        {gate.mode === "internal" ? <CompanyOnboarding>{children}</CompanyOnboarding> : children}
      </StratoAuthProvider>
    );

  if (gate.status === "loading")
    return (
      <main className={styles.stage}>
        <div className={styles.loading} aria-label="Carregando STRATO">
          <img src="/brand/strato-logo-horizontal-negative.png" alt="STRATO" />
          <span />
        </div>
      </main>
    );

  const message = gate.status === "signed-out" ? gate.message : undefined;
  const messageTone = gate.status === "signed-out" ? gate.tone : undefined;

  return (
    <main className={styles.stage}>
      <section className={styles.card} aria-labelledby="auth-title">
        <div className={styles.brand}>
          <img src="/brand/strato-logo-horizontal-color.png" alt="STRATO" />
          <span>Receivables OS</span>
        </div>
        <div className={styles.intro}>
          <span>{registering ? "SOLICITAÇÃO DE ACESSO" : "ACESSO SEGURO"}</span>
          <h1 id="auth-title">{registering ? "Seu acesso começa aqui." : "Seu dia começa com contexto."}</h1>
          <p>
            {registering
              ? "Cadastre sua identidade. Um administrador definirá departamento, empresas, permissões e alçadas antes da liberação."
              : "Entre para acessar sua carteira, tarefas, alçadas e o resumo inteligente do dia."}
          </p>
        </div>
        <form className={styles.form} onSubmit={registering ? requestAccess : submit}>
          {registering && (
            <label>
              <span>Nome completo</span>
              <input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required />
            </label>
          )}
          <label>
            <span>E-mail corporativo</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="nome@empresa.com.br"
              required
            />
          </label>
          {registering && (
            <label>
              <span>Departamento solicitado</span>
              <select value={department} onChange={event => setDepartment(event.target.value as UserDepartment)}>
                {departments.map(item => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>{registering ? "Crie uma senha" : "Senha"}</span>
            <div className={styles.password}>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={registering ? "10+ caracteres, letras e número" : "Sua senha"}
                required
              />
              <button type="button" onClick={() => setShowPassword(value => !value)}>
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          {registering && (
            <label>
              <span>Confirme a senha</span>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                required
              />
            </label>
          )}
          {message && <p className={messageTone === "success" ? styles.success : styles.error}>{message}</p>}
          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? "Processando…" : registering ? "Enviar para aprovação" : "Entrar no STRATO"}
          </button>
          <button
            className={styles.switchMode}
            type="button"
            onClick={() => {
              setRegistering(value => !value);
              setGate({ status: "signed-out" });
            }}
          >
            {registering ? "Já tenho acesso" : "Solicitar novo acesso"}
          </button>
        </form>
        {localDemo && !registering && (
          <div className={styles.demo}>
            <span>Ambiente local</span>
            <button type="button" onClick={enterDemo} disabled={submitting}>
              Continuar na demonstração
            </button>
          </div>
        )}
        <footer>
          <span>Autenticação própria do STRATO</span>
          <i />
          <span>Acesso conforme perfil, empresa e alçada</span>
        </footer>
      </section>
      <aside className={styles.visual} aria-hidden="true">
        <div className={styles.grid} />
        <div className={styles.orbitOne} />
        <div className={styles.orbitTwo} />
        <div className={styles.glow} />
        <div className={styles.scanner} />
        <div className={styles.core}>
          <i />
          <span>STRATO CORE</span>
          <strong>Contexto vivo</strong>
          <small>128 sinais conectados</small>
        </div>
        <div className={`${styles.floatCard} ${styles.portfolioCard}`}>
          <span>CARTEIRA ATIVA</span>
          <strong>R$ 18,4 mi</strong>
          <small className={styles.positive}>↑ 2,8% no período</small>
          <div className={styles.sparkline}>
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className={`${styles.floatCard} ${styles.decisionCard}`}>
          <span>DECISÕES</span>
          <strong>2 aguardam você</strong>
          <small>R$ 5,04 mi sob análise</small>
        </div>
        <div className={`${styles.floatCard} ${styles.targetCard}`}>
          <span>META DO MÊS</span>
          <strong>84%</strong>
          <small>Ritmo acima do previsto</small>
          <div className={styles.progress}>
            <i />
          </div>
        </div>
        <div className={`${styles.floatCard} ${styles.liquidityCard}`}>
          <span>LIQUIDEZ LIVRE</span>
          <strong>R$ 3,35 mi</strong>
          <small>4,3× liberações prontas</small>
        </div>
        <div className={`${styles.floatCard} ${styles.riskCard}`}>
          <span>RISCO MONITORADO</span>
          <strong>1 concentração</strong>
          <small>Revisão recomendada</small>
        </div>
        <div className={`${styles.floatCard} ${styles.tasksCard}`}>
          <span>CENTRAL DO DIA</span>
          <strong>6 tarefas</strong>
          <small>3 prioritárias · 2 novas</small>
        </div>
        <div className={styles.signal}>
          <span>CÉREBRO OPERACIONAL</span>
          <strong>O sistema conecta os sinais.</strong>
          <small>Risco, operação, carteira e metas atualizados em um só contexto.</small>
        </div>
      </aside>
    </main>
  );
}
