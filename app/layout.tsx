/**
 * Layout raiz do Next: fontes, metadados e o script que aplica o tema salvo antes da primeira pintura.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { themeBootScript } from "@/src/features/shell/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      <body className={`${geist.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
