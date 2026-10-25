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
          pains: ["Operações complexas.", "Sistemas que não conversam.", "Planilha para fechar o dia.", "Nenhuma visão do negócio."],
          answer: "O STRATO junta tudo",
          answerAccent: "em uma operação só.",
          cta: "Agende uma demonstração",
          contact: "strato.com.br",
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
          pains: ["Operações complexas.", "Sistemas que não conversam.", "Planilha para fechar o dia.", "Nenhuma visão do negócio."],
          answer: "O STRATO junta tudo",
          answerAccent: "em uma operação só.",
          cta: "Agende uma demonstração",
          contact: "strato.com.br",
        }}
      />
      <Still id="StratoThumbnail" component={Thumbnail} width={1920} height={1080} />
    </Folder>
  );
};
