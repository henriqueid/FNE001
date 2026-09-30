"use client";

/**
 * Itens e grupos do menu lateral.
 */
import { type AppView } from "./shell-context";
import {
  ActivityIcon,
  BankIcon,
  BriefcaseLineIcon,
  GridIcon,
  PlugIcon,
  ShieldIcon,
  SlidersIcon,
  UsersIcon,
  WalletIcon,
} from "@/src/ui/icons";
import { type ReactNode } from "react";

export type NavItem = { label: string; view?: AppView; icon: ReactNode; hint: string };

export const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { label: "Visão geral", view: "home", icon: <GridIcon />, hint: "Resultado, carteira, caixa e pendências" },
      {
        label: "Operações",
        view: "operations",
        icon: <ActivityIcon />,
        hint: "Central, esteira e workspace da operação",
      },
      { label: "Carteira", view: "portfolio", icon: <WalletIcon />, hint: "Títulos, vencimentos, atraso e cobrança" },
    ],
  },
  {
    title: "Gestão",
    items: [
      {
        label: "Comercial",
        view: "commercial",
        icon: <BriefcaseLineIcon />,
        hint: "Metas, funil, comitês e comissões",
      },
      { label: "Financeiro", view: "finance", icon: <BankIcon />, hint: "Caixa, contas, conciliação e contábil" },
    ],
  },
  {
    title: "Plataforma",
    items: [
      { label: "Cadastros", view: "registry", icon: <UsersIcon />, hint: "Cedentes, sacados, grupos e contas" },
      { label: "Políticas", view: "policies", icon: <ShieldIcon />, hint: "Crédito, lastro, preço e alçadas" },
      {
        label: "Integrações",
        view: "integrations",
        icon: <PlugIcon />,
        hint: "Receita, SEFAZ, bureaus, bancos e assinatura",
      },
      { label: "Configurações", icon: <SlidersIcon />, hint: "Preferências da interface" },
    ],
  },
];

export const allNav = navGroups.flatMap(group => group.items);
