import { Composition, Folder, Still } from "remotion";
import { StratoPromo, totalFrames } from "./StratoPromo";
import { Thumbnail } from "./Thumbnail";

export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="STRATO">
      <Composition
        id="StratoPromo"
        component={StratoPromo}
        durationInFrames={totalFrames(30)}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          pains: ["Sistemas complexos.", "Telas demais.", "Informação espalhada.", "Nenhuma visão do negócio."],
          answer: "Uma plataforma.",
          answerAccent: "A operação inteira à vista.",
          slogan: "Menos planilha.",
          sloganAccent: "Mais decisão.",
          cta: "Agende uma demonstração",
          contact: "",
        }}
      />
      <Composition
        id="StratoPromoVertical"
        component={StratoPromo}
        durationInFrames={totalFrames(30)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          pains: ["Sistemas complexos.", "Telas demais.", "Informação espalhada.", "Nenhuma visão do negócio."],
          answer: "Uma plataforma.",
          answerAccent: "A operação inteira à vista.",
          slogan: "Menos planilha.",
          sloganAccent: "Mais decisão.",
          cta: "Agende uma demonstração",
          contact: "",
        }}
      />
      <Still id="StratoThumbnail" component={Thumbnail} width={1920} height={1080} />
    </Folder>
  );
};
