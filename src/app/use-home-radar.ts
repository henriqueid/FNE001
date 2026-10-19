"use client";
/** Atualiza o radar visível sem sobrepor requisições; mantém novidades pendentes até a leitura. */
import { useEffect, useRef, useState } from "react";
import type { RadarSnapshot } from "@/src/domain/home/radar";
import { authenticatedFetch } from "./session-client";

export function useHomeRadar(tenantId: string, enabled: boolean, companyScope: string, identity: string) {
  const [snapshot, setSnapshot] = useState<RadarSnapshot>();
  const [pending, setPending] = useState<RadarSnapshot>();
  const [error, setError] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [sourceKey, setSourceKey] = useState("");
  const baseline = useRef<{ key: string; snapshot: RadarSnapshot } | undefined>(undefined);
  const key = `${tenantId}:${companyScope}:${identity}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const response = await authenticatedFetch(
          `/api/home/radar?company=${encodeURIComponent(companyScope)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
          tenantId,
        );
        if (!response.ok) {
          if (active && (response.status === 401 || response.status === 403)) {
            baseline.current = undefined;
            setSnapshot(undefined);
            setPending(undefined);
            setSourceKey("");
          }
          throw new Error("O radar está indisponível. Tente atualizar novamente.");
        }
        const next = (await response.json()) as RadarSnapshot;
        if (!active) return;
        setSourceKey(key);
        setError(undefined);
        const known = baseline.current?.key === key ? baseline.current.snapshot : undefined;
        if (!known) {
          baseline.current = { key, snapshot: next };
          setSnapshot(next);
          setPending(undefined);
        } else {
          const ids = new Set(known.events.map(event => event.id));
          if (next.events.some(event => !ids.has(event.id))) setPending(next);
          else {
            setSnapshot(next);
            baseline.current = { key, snapshot: next };
            setPending(undefined);
          }
        }
      } catch {
        if (active) setError("O radar está indisponível. A última posição pode estar desatualizada.");
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tenantId, enabled, companyScope, refreshKey, key]);
  return {
    snapshot: enabled && sourceKey === key ? snapshot : undefined,
    pending: enabled && sourceKey === key ? pending : undefined,
    error: enabled ? error : undefined,
    refresh: () => setRefreshKey(value => value + 1),
    accept: () => {
      if (pending) {
        baseline.current = { key, snapshot: pending };
        setSnapshot(pending);
        setPending(undefined);
      }
    },
  };
}
