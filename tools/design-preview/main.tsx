/** Aplicativo completo em demonstração local; refinamento alternável sem duplicar telas. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import StratoApp from "@/src/app/strato-app";
import { CompanyDirectoryProvider } from "@/src/app/company-context";
import { StratoAuthProvider } from "@/src/features/auth/auth-context";
import { CompanyOnboarding } from "@/src/features/onboarding/company-onboarding";
import { AuthGate } from "@/src/features/auth/auth-gate";
import "@fontsource-variable/urbanist/wght.css";
import "@/app/styles/tokens.generated.css";
import "@/app/styles/legacy.css";
import "@/app/styles/commercial.css";
import "@/app/styles/live-operations.css";
import "@/app/styles/design-system.css";
import "@/app/styles/ledger.css";
import "@/app/styles/copilot-report.css";
import "@/app/styles/responsive.css";
import "@/app/styles/home-radar.css";
import "./refinements.css";

function Preview() {
  const params = new URLSearchParams(location.search);
  const [refined, setRefined] = useState(params.get("design") !== "original");
  const [company, setCompany] = useState(params.get("screen") === "company");
  const [access, setAccess] = useState(params.get("screen") === "access");
  const change = (key: string, value: string) => {
    const url = new URL(location.href);
    url.searchParams.set(key, value);
    history.replaceState(null, "", url);
  };
  return (
    <>
      <div className="preview-controls">
        <span>
          Demonstração completa <small>· dados fictícios · salvamento somente local</small>
        </span>
        <div role="group" aria-label="Comparar aparência">
          <button
            aria-pressed={!refined}
            onClick={() => {
              setRefined(false);
              change("design", "original");
            }}
          >
            Original
          </button>
          <button
            aria-pressed={refined}
            onClick={() => {
              setRefined(true);
              change("design", "refined");
            }}
          >
            Refinado
          </button>
          <button
            aria-pressed={access}
            onClick={() => {
              setCompany(false);
              setAccess(value => !value);
              change("screen", access ? "app" : "access");
            }}
          >
            {access ? "Sistema" : "Acesso"}
          </button>
          <button
            aria-pressed={company}
            onClick={() => {
              setCompany(value => !value);
              change("screen", company ? "app" : "company");
            }}
          >
            Empresa
          </button>
        </div>
      </div>
      <div className={refined ? "st-refined" : undefined}>
        {company ? (
          <CompanyOnboarding>
            <p>Cadastro real exige servidor configurado.</p>
          </CompanyOnboarding>
        ) : access ? (
          <AuthGate>
            <p>Autenticação real exige servidor configurado.</p>
          </AuthGate>
        ) : (
          <StratoAuthProvider
            value={{
              mode: "demo",
              signOut: async () => {
                setAccess(true);
                change("screen", "access");
              },
            }}
          >
            <CompanyDirectoryProvider>
              <StratoApp />
            </CompanyDirectoryProvider>
          </StratoAuthProvider>
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
