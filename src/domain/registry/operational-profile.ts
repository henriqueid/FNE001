import type { InstitutionType } from "@/src/domain/core/types";
import type { HomePeriod } from "@/src/domain/home/settings";

export type CalculationMethod = "Nominal" | "Efetiva" | "Mista" | "Composta Mista";
export type ConfirmationFailureAction = "Bloquear" | "Enviar para alçada" | "Solicitar nova amostra" | "Alertar";

export type OperationalParameters = {
  monthlyRate: number;
  minimumMonthlyRate: number;
  maximumMonthlyRate: number;
  calculationMethod: CalculationMethod;
  dayBasis: 30 | 360 | 365;
  businessDays: boolean;
  minimumTermDays: number;
  maximumTermDays: number;
  maximumAverageTermDays: number;
  minimumTitleAmount: number;
  maximumTitleAmount: number;
  maximumOperationAmount: number;
  maximumTitlesPerOperation: number;
  minimumConfirmationCountPercent: number;
  minimumConfirmationAmountPercent: number;
  minimumConfirmedTitles: number;
  confirmationValidityDays: number;
  firstOperationsConfirmationPercent: number;
  firstOperationsCount: number;
  requireLargestTitles: boolean;
  confirmationFailureAction: ConfirmationFailureAction;
  samplePercent: number;
  maximumDebtorConcentrationPercent: number;
  maximumTopFiveConcentrationPercent: number;
  maximumGroupConcentrationPercent: number;
  maximumSectorConcentrationPercent: number;
  operationFee: number;
  titleFee: number;
  analysisFee: number;
  registrationFee: number;
  checkingFee: number;
  bankFee: number;
  reservePercent: number;
  repurchaseTermDays: number;
  lateFinePercent: number;
  lateInterestPercent: number;
};

export type OperationalParameterOverrides = Partial<OperationalParameters>;

export type LimitTranche = {
  id: string;
  name: string;
  amount: number;
  institution: InstitutionType | "Todos";
  vehicle: string;
  modality: string;
  receivableType: string;
  maximumOperationAmount?: number;
  monthlyRate?: number;
  maximumTermDays?: number;
  maximumDebtorConcentrationPercent?: number;
  validUntil: string;
  priority: number;
  allowSharing: boolean;
  active: boolean;
};

export type ClientContractProfile = {
  number: string;
  signedAt: string;
  validFrom: string;
  validUntil: string;
  automaticRenewal: boolean;
  allowedInstitutions: InstitutionType[];
  allowedReceivables: string[];
  notes: string;
};

export type ClientComplianceProfile = {
  kycStatus: "Pendente" | "Em análise" | "Aprovado" | "Reprovado";
  coafQualified: boolean;
  politicallyExposed: boolean;
  beneficialOwnerIdentified: boolean;
  sanctionsCheckedAt: string;
  registrationReviewAt: string;
  creditReviewAt: string;
};

export type OperationalDefaultsState = {
  version: 1;
  general: OperationalParameters;
  revenueGoals: {
    consolidated: Record<HomePeriod, number>;
    byVehicle: Record<string, Partial<Record<HomePeriod, number>>>;
  };
};

export const defaultOperationalParameters: OperationalParameters = {
  monthlyRate: 2.5,
  minimumMonthlyRate: 1.8,
  maximumMonthlyRate: 4.5,
  calculationMethod: "Composta Mista",
  dayBasis: 30,
  businessDays: false,
  minimumTermDays: 15,
  maximumTermDays: 180,
  maximumAverageTermDays: 90,
  minimumTitleAmount: 100,
  maximumTitleAmount: 500_000,
  maximumOperationAmount: 2_000_000,
  maximumTitlesPerOperation: 500,
  minimumConfirmationCountPercent: 70,
  minimumConfirmationAmountPercent: 80,
  minimumConfirmedTitles: 3,
  confirmationValidityDays: 15,
  firstOperationsConfirmationPercent: 100,
  firstOperationsCount: 3,
  requireLargestTitles: true,
  confirmationFailureAction: "Enviar para alçada",
  samplePercent: 30,
  maximumDebtorConcentrationPercent: 25,
  maximumTopFiveConcentrationPercent: 70,
  maximumGroupConcentrationPercent: 30,
  maximumSectorConcentrationPercent: 40,
  operationFee: 75,
  titleFee: 4.5,
  analysisFee: 250,
  registrationFee: 35,
  checkingFee: 12,
  bankFee: 15,
  reservePercent: 2,
  repurchaseTermDays: 3,
  lateFinePercent: 2,
  lateInterestPercent: 1,
};

export const seedOperationalDefaults = (): OperationalDefaultsState => ({
  version: 1,
  general: { ...defaultOperationalParameters },
  revenueGoals: {
    consolidated: { dia: 30_000, semana: 150_000, mes: 600_000 },
    byVehicle: {},
  },
});

export function migrateOperationalDefaults(value: unknown): OperationalDefaultsState {
  if (!value || typeof value !== "object") return seedOperationalDefaults();
  const stored = value as Partial<OperationalDefaultsState>;
  return {
    version: 1,
    general: { ...defaultOperationalParameters, ...(stored.general ?? {}) },
    revenueGoals: {
      consolidated: {
        ...seedOperationalDefaults().revenueGoals.consolidated,
        ...(stored.revenueGoals?.consolidated ?? {}),
      },
      byVehicle: stored.revenueGoals?.byVehicle ?? {},
    },
  };
}

/** `undefined` herda o geral; zero é preservado como escolha explícita do cliente. */
export function resolveOperationalParameters(
  defaults: OperationalDefaultsState,
  overrides?: OperationalParameterOverrides,
): OperationalParameters {
  return { ...defaults.general, ...(overrides ?? {}) };
}

export const inheritedParameterCount = (overrides?: OperationalParameterOverrides) =>
  Object.keys(defaultOperationalParameters).length - Object.keys(overrides ?? {}).length;
