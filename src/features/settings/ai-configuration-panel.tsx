"use client";

import { loadAIConfiguration, testAIConfiguration, type AIProviderConfiguration } from "@/src/app/intelligence-client";
import { useEffect, useRef, useState } from "react";

type CheckState = "idle" | "loading" | "success" | "error";

export function AIConfigurationPanel({
  active = false,
  onAvailabilityChange,
}: {
  active?: boolean;
  onAvailabilityChange?: (available: boolean) => void;
}) {
  const [configuration, setConfiguration] = useState<AIProviderConfiguration | null>(null);
  const [state, setState] = useState<CheckState>("loading");
  const [message, setMessage] = useState("");
  const availabilityChange = useRef(onAvailabilityChange);

  useEffect(() => {
    availabilityChange.current = onAvailabilityChange;
  }, [onAvailabilityChange]);

  const refresh = () => {
    setState("loading");
    setMessage("");
    return loadAIConfiguration()
      .then(result => {
        setConfiguration(result);
        setState("idle");
      })
      .catch(error => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível ler a configuração do servidor.");
      });
  };

  useEffect(() => {
    let mounted = true;
    void loadAIConfiguration()
      .then(async result => {
        if (!mounted) return;
        setConfiguration(result);
        if (!active || !result.configured) {
          setState("idle");
          return;
        }
        const tested = await testAIConfiguration();
        if (!mounted) return;
        setConfiguration(tested.configuration);
        setState("success");
        setMessage(`Conexão validada com ${tested.test.model}. O Copiloto já pode responder perguntas livres.`);
        availabilityChange.current?.(true);
      })
      .catch(error => {
        if (!mounted) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Não foi possível ler a configuração do servidor.");
        if (active) availabilityChange.current?.(false);
      });
    return () => {
      mounted = false;
    };
  }, [active]);

  const test = () => {
    setState("loading");
    setMessage("");
    void testAIConfiguration()
      .then(result => {
        setConfiguration(result.configuration);
        setState("success");
        setMessage(`Conexão validada com ${result.test.model}. O Copiloto já pode responder perguntas livres.`);
        onAvailabilityChange?.(true);
      })
      .catch(error => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "A conexão com a IA falhou.");
        onAvailabilityChange?.(false);
      });
  };

  return (
    <section className="settings-ai-provider" aria-labelledby="settings-ai-provider-title">
      <header>
        <div>
          <span>ETAPA 3 · CONEXÃO TÉCNICA</span>
          <h3 id="settings-ai-provider-title">Conexão com a OpenAI</h3>
          <p>Valide aqui se o servidor consegue receber uma resposta real do modelo.</p>
        </div>
        <b data-state={state === "error" ? "missing" : configuration?.configured ? "configured" : "missing"}>
          {state === "loading"
            ? "Verificando…"
            : state === "error" && configuration?.configured
              ? "Provedor indisponível"
              : state === "success"
                ? "Conexão validada"
                : configuration?.configured
                  ? "Teste pendente"
                  : "Credencial ausente"}
        </b>
      </header>

      <div className="settings-ai-details">
        <span>
          <small>Provedor</small>
          <strong>Responses API</strong>
        </span>
        <span>
          <small>Modelo</small>
          <strong>{configuration?.model ?? "—"}</strong>
        </span>
        <span>
          <small>Chave</small>
          <strong>{configuration?.keyHint ?? "Não configurada"}</strong>
        </span>
        <span>
          <small>Endpoint</small>
          <strong>{configuration?.endpoint ?? "—"}</strong>
        </span>
      </div>

      {!configuration?.configured && state !== "loading" && (
        <div className="settings-ai-instructions">
          <strong>Como ativar</strong>
          <ol>
            <li>Crie uma chave de projeto na OpenAI.</li>
            <li>
              Defina <code>OPENAI_API_KEY</code> e, opcionalmente, <code>OPENAI_MODEL</code> no ambiente do servidor.
            </li>
            <li>Reinicie o serviço e use o teste de conexão abaixo.</li>
          </ol>
        </div>
      )}

      <div className="settings-ai-actions">
        <button type="button" onClick={test} disabled={state === "loading" || !configuration?.configured}>
          {state === "loading" ? "Enviando pergunta de teste…" : "Testar resposta da IA"}
        </button>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={state === "loading"}>
          Recarregar configuração
        </button>
      </div>
      {message && (
        <p className="settings-ai-feedback" data-state={state} role={state === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}
    </section>
  );
}
