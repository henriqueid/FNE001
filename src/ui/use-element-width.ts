"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mede a largura real do elemento e acompanha mudanças (redimensionar janela, zoom,
 * abrir/fechar painéis). Os gráficos em SVG usam esse valor como largura do viewBox,
 * assim ganham mais pontos/espaço em telas largas em vez de só "esticar" o desenho.
 */
export function useElementWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(prev => (Math.abs(prev - next) > 1 ? next : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Igual a useElementWidth, mas devolve também a altura (para gráficos que preenchem o card). */
export function useElementSize<T extends Element>(fallback: { width: number; height: number }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0) return;
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setSize(prev => (Math.abs(prev.width - next.width) > 1 || Math.abs(prev.height - next.height) > 1 ? next : prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
