"use client";

import { loadAIConfiguration, testAIConfiguration, type AIProviderConfiguration } from "@/src/app/intelligence-client";
import { useEffect, useState } from "react";

type CheckState = "idle" | "loading" | "success" | "error";

export function AIConfigurationPanel() {
  const [configuration, setConfiguration] = useState<AIProviderConfiguration | null>(null);
  const [state, setState] = useState<CheckState>("loading");
  const [message, setMessage] = useState("");

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
    void refresh();
  }, []);

  const test = () => {
    setState("loading");
    setMessage("");
    void testAIConfiguration()
      .then(result => {
        setConfiguration(result.configuration);
        setState("success");
        setMessage(`Conexão validada com ${result.test.model}. O Copiloto já pode responder perguntas livres.`);
      })
      .catch(error => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "A conexão com a IA falhou.");
      });
  };

  return (
    <section className="settings-ai-provider" aria-labelledby="settings-ai-provider-title">
      <header>
        <div>
          <span>PROVEDOR DO COPILOTO</span>
          <h3 id="settings-ai-provider-title">OpenAI Responses API</h3>
          <p>A credencial fica exclusivamente no servidor e nunca é enviada ao navegador.</p>
        </div>
        <b data-state={configuration?.configured ? "configured" : "missing"}>
          {state === "loading"
            ? "Verificando…"
            : configuration?.configured
              ? "Credencial configurada"
              : "Credencial ausente"}
        </b>
      </header>

      <div className="settings-ai-details">
        <span>
          <small>Provedor</small>
          <strong>OpenAI</strong>
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
          {state === "loading" ? "Verificando conexão…" : "Testar conexão"}
        </button>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={state === "loading"}>
          Atualizar estado
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
