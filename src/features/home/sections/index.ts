/**
 * Componentes de conteúdo dos cards da visão geral, um arquivo por seção.
 * Recebem dados já calculados (ver `use-home-metrics.ts`) e só cuidam da apresentação.
 */
export { Aging } from "./aging";
export { Alerts, type Alert } from "./alerts";
export { Collection, type CollectionRow } from "./collection";
export { Concentration, type Row } from "./concentration";
export { MaturityAgenda } from "./maturity-agenda";
export { Milestones, type Milestone } from "./milestones";
export { NeedsYou, type NeedItem } from "./needs-you";
export { Pipeline } from "./pipeline";
export { RevenueMix } from "./revenue-mix";
export { Team } from "./team";
