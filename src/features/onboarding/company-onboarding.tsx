"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { type CompanyProfile } from "@/src/domain/company/profile";
import { getStratoTenantId } from "@/src/app/tenant";
import { CompanyProvider } from "@/src/app/company-context";
import { consultLeadCnpj } from "@/src/app/cnpj-enrichment-client";
import { consultCep } from "@/src/app/public-enrichment-client";
import { formatDocument, formatZip, onlyDigits } from "@/src/domain/registry/parties";
import styles from "./company-onboarding.module.css";

const emptyCompany: CompanyProfile = {
  legalName: "",
  tradeName: "",
  document: "",
  institutionType: "Factoring",
  email: "",
  phone: "",
  website: "",
  foundationDate: "",
  address: { zipCode: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
};

export function CompanyOnboarding({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "required" | "ready">("loading");
  const [company, setCompany] = useState<CompanyProfile>(emptyCompany);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState<"cnpj" | "cep" | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/company", { cache: "no-store", headers: { "x-strato-tenant-id": getStratoTenantId() } })
      .then(async response => {
        if (!response.ok) throw new Error("Não foi possível consultar a empresa.");
        const body = (await response.json()) as { company: CompanyProfile | null };
        if (active) {
          if (body.company) setCompany(body.company);
          setStatus(body.company ? "ready" : "required");
        }
      })
      .catch(reason => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Falha ao abrir o cadastro.");
          setStatus("required");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  if (status === "ready") return <CompanyProvider value={company}>{children}</CompanyProvider>;
  if (status === "loading")
    return (
      <main className={styles.stage}>
        <div className={styles.loading}>Preparando sua empresa…</div>
      </main>
    );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-strato-tenant-id": getStratoTenantId() },
        body: JSON.stringify(company),
      });
      const raw = await response.text();
      const body = raw ? (JSON.parse(raw) as { error?: string; company?: CompanyProfile }) : {};
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a empresa.");
      if (body.company) setCompany(body.company);
      setStatus("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a empresa.");
    } finally {
      setSaving(false);
    }
  };
  const address = (key: keyof CompanyProfile["address"], value: string) =>
    setCompany(current => ({ ...current, address: { ...current.address, [key]: value } }));
  const lookupCnpj = async () => {
    setLookingUp("cnpj");
    setError("");
    setLookupMessage("");
    try {
      const evidence = await consultLeadCnpj(company.document);
      setCompany(current => ({
        ...current,
        legalName: evidence.legalName || current.legalName,
        tradeName: evidence.tradeName || evidence.legalName || current.tradeName,
        foundationDate: evidence.openedAt || current.foundationDate,
        email: evidence.email || current.email,
        phone: evidence.phones[0] || current.phone,
        address: {
          ...current.address,
          zipCode: evidence.address.zipCode || current.address.zipCode,
          street: evidence.address.street || current.address.street,
          number: evidence.address.number || current.address.number,
          complement: evidence.address.complement || current.address.complement,
          district: evidence.address.district || current.address.district,
          city: evidence.address.city || current.address.city,
          state: evidence.address.state || current.address.state,
        },
      }));
      setLookupMessage(`CNPJ consultado · situação ${evidence.registrationStatus.label} · BrasilAPI`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setLookingUp(null);
    }
  };
  const lookupCep = async () => {
    setLookingUp("cep");
    setError("");
    setLookupMessage("");
    try {
      const evidence = await consultCep(company.address.zipCode);
      setCompany(current => ({
        ...current,
        address: {
          ...current.address,
          zipCode: evidence.zipCode,
          street: evidence.street || current.address.street,
          district: evidence.district || current.address.district,
          city: evidence.city,
          state: evidence.state,
        },
      }));
      setLookupMessage(`CEP conferido · ${evidence.city}/${evidence.state} · ${evidence.provider}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar o CEP.");
    } finally {
      setLookingUp(null);
    }
  };
  return (
    <main className={styles.stage}>
      <section className={styles.card}>
        <header>
          <img src="/brand/strato-logo-horizontal-color.png" alt="STRATO" />
          <span>CONFIGURAÇÃO INICIAL</span>
          <h1>Vamos cadastrar sua empresa.</h1>
          <p>
            Este é o primeiro registro real do ambiente. Depois dele, clientes, operações e usuários começam do zero.
          </p>
        </header>
        <form onSubmit={submit}>
          <div className={styles.grid}>
            <label className={styles.wide}>
              <span>Razão social *</span>
              <input
                required
                value={company.legalName}
                onChange={e => setCompany({ ...company, legalName: e.target.value })}
              />
            </label>
            <label>
              <span>Nome fantasia *</span>
              <input
                required
                value={company.tradeName}
                onChange={e => setCompany({ ...company, tradeName: e.target.value })}
              />
            </label>
            <label>
              <span>CNPJ *</span>
              <div className={styles.lookupRow}>
                <input
                  required
                  inputMode="numeric"
                  value={company.document}
                  onChange={e => setCompany({ ...company, document: formatDocument(e.target.value) })}
                />
                <button
                  type="button"
                  className={styles.lookupButton}
                  disabled={lookingUp != null || onlyDigits(company.document).length !== 14}
                  onClick={() => void lookupCnpj()}
                >
                  {lookingUp === "cnpj" ? "Consultando…" : "Consultar"}
                </button>
              </div>
            </label>
            <label>
              <span>Tipo de instituição *</span>
              <select
                value={company.institutionType}
                onChange={e =>
                  setCompany({ ...company, institutionType: e.target.value as CompanyProfile["institutionType"] })
                }
              >
                <option>Factoring</option>
                <option>Empresa de fomento</option>
                <option>Securitizadora</option>
                <option>FIDC</option>
                <option>Outro</option>
              </select>
            </label>
            <label>
              <span>Data de fundação</span>
              <input
                type="date"
                value={company.foundationDate}
                onChange={e => setCompany({ ...company, foundationDate: e.target.value })}
              />
            </label>
            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={company.email}
                onChange={e => setCompany({ ...company, email: e.target.value })}
              />
            </label>
            <label>
              <span>Telefone</span>
              <input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} />
            </label>
            <label>
              <span>CEP</span>
              <div className={styles.lookupRow}>
                <input value={company.address.zipCode} onChange={e => address("zipCode", formatZip(e.target.value))} />
                <button
                  type="button"
                  className={styles.lookupButton}
                  disabled={lookingUp != null || onlyDigits(company.address.zipCode).length !== 8}
                  onClick={() => void lookupCep()}
                >
                  {lookingUp === "cep" ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </label>
            <label>
              <span>Logradouro</span>
              <input value={company.address.street} onChange={e => address("street", e.target.value)} />
            </label>
            <label>
              <span>Número</span>
              <input value={company.address.number} onChange={e => address("number", e.target.value)} />
            </label>
            <label>
              <span>Cidade</span>
              <input value={company.address.city} onChange={e => address("city", e.target.value)} />
            </label>
            <label>
              <span>UF</span>
              <input
                maxLength={2}
                value={company.address.state}
                onChange={e => address("state", e.target.value.toUpperCase())}
              />
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          {lookupMessage && <p className={styles.success}>{lookupMessage}</p>}
          <footer>
            <small>Você poderá completar e alterar os dados em Configurações.</small>
            <button disabled={saving}>{saving ? "Salvando…" : "Criar empresa e começar"}</button>
          </footer>
        </form>
      </section>
    </main>
  );
}
