"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { type AuthChangeEvent } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/src/supabase/browser";
import { getStratoTenantId } from "@/src/supabase/config";
import { StratoAuthProvider, type StratoAuthMode } from "./auth-context";
import styles from "./auth-gate.module.css";

const TENANT_ID = getStratoTenantId();

type GateState =
  { status: "loading" } | { status: "signed-out"; message?: string } | { status: "signed-in"; mode: StratoAuthMode };

async function verifyAccess(accessToken?: string) {
  const response = await fetch("/api/auth/session", {
    headers: {
      "x-strato-tenant-id": TENANT_ID,
      "x-strato-auth-probe": "1",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
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
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localDemo, setLocalDemo] = useState(false);

  const resolveSession = useCallback(async () => {
    const supabase = supabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      if (await verifyAccess(session.access_token)) {
        setGate({ status: "signed-in", mode: "supabase" });
        return;
      }
      await supabase.auth.signOut({ scope: "local" });
      setGate({
        status: "signed-out",
        message: "Sua conta existe, mas ainda não está vinculada a uma empresa ativa no STRATO.",
      });
      return;
    }
    if (await verifyAccess()) {
      setGate({ status: "signed-in", mode: "demo" });
      return;
    }
    setGate({ status: "signed-out" });
  }, []);

  useEffect(() => {
    const demoTimer = window.setTimeout(
      () => setLocalDemo(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"),
      0,
    );
    const sessionTimer = window.setTimeout(
      () =>
        void resolveSession().catch(() =>
          setGate({ status: "signed-out", message: "Não foi possível validar a sessão." }),
        ),
      0,
    );
    const { data } = supabaseBrowser().auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "SIGNED_OUT") setGate({ status: "signed-out" });
    });
    return () => {
      window.clearTimeout(demoTimer);
      window.clearTimeout(sessionTimer);
      data.subscription.unsubscribe();
    };
  }, [resolveSession]);

  const signOut = useCallback(async () => {
    if (gate.status === "signed-in" && gate.mode === "supabase") await supabaseBrowser().auth.signOut();
    else await fetch("/api/auth/session", { method: "DELETE" });
    setGate({ status: "signed-out" });
  }, [gate]);

  const context = useMemo(
    () => (gate.status === "signed-in" ? { mode: gate.mode, signOut } : undefined),
    [gate, signOut],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setGate({ status: "signed-out" });
    try {
      const { data, error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        setGate({ status: "signed-out", message: "E-mail ou senha inválidos." });
        return;
      }
      if (!(await verifyAccess(data.session.access_token))) {
        await supabaseBrowser().auth.signOut({ scope: "local" });
        setGate({
          status: "signed-out",
          message: "Login confirmado, mas este e-mail ainda não possui vínculo ativo no STRATO.",
        });
        return;
      }
      setGate({ status: "signed-in", mode: "supabase" });
    } catch {
      setGate({ status: "signed-out", message: "Não foi possível entrar agora. Tente novamente." });
    } finally {
      setSubmitting(false);
    }
  };

  const enterDemo = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "x-strato-tenant-id": TENANT_ID },
      });
      if (!response.ok) throw new Error("demo unavailable");
      setGate({ status: "signed-in", mode: "demo" });
    } catch {
      setGate({ status: "signed-out", message: "A demonstração local não pôde ser iniciada." });
    } finally {
      setSubmitting(false);
    }
  };

  if (gate.status === "signed-in" && context)
    return <StratoAuthProvider value={context}>{children}</StratoAuthProvider>;

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

  return (
    <main className={styles.stage}>
      <section className={styles.card} aria-labelledby="auth-title">
        <div className={styles.brand}>
          <img src="/brand/strato-logo-horizontal-negative.png" alt="STRATO" />
          <span>Receivables OS</span>
        </div>
        <div className={styles.intro}>
          <span>Acesso seguro</span>
          <h1 id="auth-title">Seu dia começa com contexto.</h1>
          <p>Entre para acessar sua carteira, tarefas, alçadas e o resumo inteligente do dia.</p>
        </div>
        <form className={styles.form} onSubmit={submit}>
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
          <label>
            <span>Senha</span>
            <div className={styles.password}>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Sua senha"
                required
              />
              <button type="button" onClick={() => setShowPassword(value => !value)}>
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          {message && <p className={styles.error}>{message}</p>}
          <button className={styles.submit} type="submit" disabled={submitting}>
            {submitting ? "Validando acesso…" : "Entrar no STRATO"}
          </button>
        </form>
        {localDemo && (
          <div className={styles.demo}>
            <span>Ambiente local</span>
            <button type="button" onClick={enterDemo} disabled={submitting}>
              Continuar na demonstração
            </button>
          </div>
        )}
        <footer>
          <span>Autenticação protegida pelo Supabase</span>
          <i />
          <span>Acesso conforme perfil e empresa</span>
        </footer>
      </section>
      <aside className={styles.visual} aria-hidden="true">
        <div className={styles.orbitOne} />
        <div className={styles.orbitTwo} />
        <div className={styles.glow} />
        <div className={styles.signal}>
          <span>POSIÇÃO OPERACIONAL</span>
          <strong>Controle em tempo real</strong>
          <small>Decisões, carteira e ritmo conectados.</small>
        </div>
      </aside>
    </main>
  );
}
