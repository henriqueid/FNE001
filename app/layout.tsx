/**
 * Layout raiz do Next: metadados (fonte Urbanist auto-hospedada via @fontsource) e o script que aplica o tema salvo antes da primeira pintura.
 */
import type { Metadata } from "next";
import { themeBootScript } from "@/src/features/shell/theme";
import "@fontsource-variable/urbanist/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRATO · Receivables OS",
  description: "Operações, checagem, risco, cobrança e financeiro em um ciclo integrado.",
  icons: { icon: "/brand/strato-symbol-32.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo (claro/escuro/sistema) antes da primeira pintura. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
