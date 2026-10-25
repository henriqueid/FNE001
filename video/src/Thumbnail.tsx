import { AbsoluteFill, Freeze } from "remotion";
import "./brand/fonts";
import { fontFamily } from "./brand/tokens";
import { Manifesto } from "./scenes/Manifesto";

// Capa estática para YouTube/LinkedIn: o manifesto completo, sem animação pendente.
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Freeze frame={110}>
      <Manifesto footnote="STRATO · a plataforma operacional da antecipação de recebíveis" />
    </Freeze>
  </AbsoluteFill>
);
