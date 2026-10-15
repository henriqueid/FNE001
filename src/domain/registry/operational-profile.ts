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
  persistenceVersion?: number;
  general: OperationalParameters;
  originationGoals: {
    consolidated: Record<HomePeriod, number>;
    byVehicle: Record<string, Partial<Record<HomePeriod, number>>>;
  };
  revenueGoals: {
    consolidated: Record<HomePeriod, number>;
    byVehicle: Record<string, Partial<Record<HomePeriod, number>>>;
  };
};

export type OperationalParameterChangeRequest = {
  id: string;
  expectedVersion: number;
  previous: OperationalDefaultsState;
  proposed: OperationalDefaultsState;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedById: string;
  requestedBy: string;
  requestedAt: string;
  decidedById?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
  appliedVersion?: number;
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
  originationGoals: {
    consolidated: { dia: 1_500_000, semana: 7_500_000, mes: 30_000_000 },
    byVehicle: {},
  },
  revenueGoals: {
    consolidated: { dia: 30_000, semana: 150_000, mes: 600_000 },
    byVehicle: {},
  },
});

/** Parâmetros estruturais preservados, mas sem metas financeiras fictícias. */
export const emptyOperationalDefaults = (): OperationalDefaultsState => ({
  version: 1,
  general: { ...defaultOperationalParameters },
  originationGoals: {
    consolidated: { dia: 0, semana: 0, mes: 0 },
    byVehicle: {},
  },
  revenueGoals: {
    consolidated: { dia: 0, semana: 0, mes: 0 },
    byVehicle: {},
  },
});

export function migrateOperationalDefaults(value: unknown): OperationalDefaultsState {
  if (!value || typeof value !== "object") return seedOperationalDefaults();
  const stored = value as Partial<OperationalDefaultsState>;
  return {
    version: 1,
    persistenceVersion:
      Number.isInteger(stored.persistenceVersion) && Number(stored.persistenceVersion) >= 0
        ? Number(stored.persistenceVersion)
        : undefined,
    general: { ...defaultOperationalParameters, ...(stored.general ?? {}) },
    originationGoals: {
      consolidated: {
        ...seedOperationalDefaults().originationGoals.consolidated,
        ...(stored.originationGoals?.consolidated ?? {}),
      },
      byVehicle: stored.originationGoals?.byVehicle ?? {},
    },
    revenueGoals: {
      consolidated: {
        ...seedOperationalDefaults().revenueGoals.consolidated,
        ...(stored.revenueGoals?.consolidated ?? {}),
      },
      byVehicle: stored.revenueGoals?.byVehicle ?? {},
    },
  };
}

const finiteWithin = (value: number, minimum: number, maximum: number) =>
  Number.isFinite(value) && value >= minimum && value <= maximum;

const percentFields: Array<keyof OperationalParameters> = [
  "minimumConfirmationCountPercent",
  "minimumConfirmationAmountPercent",
  "firstOperationsConfirmationPercent",
  "samplePercent",
  "maximumDebtorConcentrationPercent",
  "maximumTopFiveConcentrationPercent",
  "maximumGroupConcentrationPercent",
  "maximumSectorConcentrationPercent",
  "reservePercent",
  "lateFinePercent",
  "lateInterestPercent",
];

const nonNegativeFields: Array<keyof OperationalParameters> = [
  "monthlyRate",
  "minimumMonthlyRate",
  "maximumMonthlyRate",
  "minimumTermDays",
  "maximumTermDays",
  "maximumAverageTermDays",
  "minimumTitleAmount",
  "maximumTitleAmount",
  "maximumOperationAmount",
  "maximumTitlesPerOperation",
  "minimumConfirmedTitles",
  "confirmationValidityDays",
  "firstOperationsCount",
  "operationFee",
  "titleFee",
  "analysisFee",
  "registrationFee",
  "checkingFee",
  "bankFee",
  "repurchaseTermDays",
];

/** Validação de fronteira usada tanto pela API quanto pelos fluxos de aprovação. */
export function validateOperationalDefaults(state: OperationalDefaultsState): string | null {
  if (state.version !== 1 || !state.general || !state.originationGoals || !state.revenueGoals)
    return "Versão dos parâmetros operacionais não suportada.";
  const general = state.general;
  if (!["Nominal", "Efetiva", "Mista", "Composta Mista"].includes(general.calculationMethod))
    return "Método de cálculo inválido.";
  if (![30, 360, 365].includes(general.dayBasis)) return "Base de dias inválida.";
  if (
    !["Bloquear", "Enviar para alçada", "Solicitar nova amostra", "Alertar"].includes(general.confirmationFailureAction)
  )
    return "Ação de falha de confirmação inválida.";
  if (percentFields.some(field => !finiteWithin(general[field] as number, 0, 100)))
    return "Percentuais operacionais devem estar entre 0 e 100.";
  if (nonNegativeFields.some(field => !finiteWithin(general[field] as number, 0, 1_000_000_000_000)))
    return "Valores e limites operacionais devem ser números não negativos.";
  if (general.minimumMonthlyRate > general.monthlyRate || general.monthlyRate > general.maximumMonthlyRate)
    return "A taxa mensal deve ficar entre a taxa mínima e a máxima.";
  if (general.minimumTermDays > general.maximumTermDays) return "O prazo mínimo não pode superar o prazo máximo.";
  if (general.maximumAverageTermDays > general.maximumTermDays)
    return "O prazo médio máximo não pode superar o prazo máximo.";
  if (general.minimumTitleAmount > general.maximumTitleAmount)
    return "O valor mínimo do título não pode superar o máximo.";
  if (general.maximumTitleAmount > general.maximumOperationAmount)
    return "O valor máximo do título não pode superar o limite por operação.";
  for (const goals of [state.originationGoals, state.revenueGoals]) {
    const values = [
      ...Object.values(goals.consolidated),
      ...Object.values(goals.byVehicle).flatMap(periods => Object.values(periods)),
    ];
    if (values.some(value => !finiteWithin(value ?? 0, 0, 1_000_000_000_000)))
      return "Metas devem ser números não negativos.";
  }
  return null;
}

export function operationalDefaultsSnapshot(state: OperationalDefaultsState): OperationalDefaultsState {
  const { persistenceVersion: _persistenceVersion, ...snapshot } = state;
  return snapshot;
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
