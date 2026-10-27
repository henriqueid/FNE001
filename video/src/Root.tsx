import { Composition, Folder, Still } from "remotion";
import { StratoFinancia } from "./financia/StratoFinancia";
import { FinanciaThumbnail } from "./financia/Thumbnail";
import { TOTAL_FRAMES as FINANCIA_FRAMES } from "./financia/data/scenes";
import { StratoProScore } from "./proscore/StratoProScore";
import { ProScoreThumbnail } from "./proscore/Thumbnail";
import { TOTAL_FRAMES } from "./proscore/data/scenes";
import { StratoPromo, totalFrames } from "./StratoPromo";
import { LinkedInComingSoon } from "./LinkedInComingSoon";
import { BemVindoNovo, NOVO_FRAMES } from "./novo/BemVindoNovo";
import { Thumbnail } from "./Thumbnail";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Folder name="STRATO-proScore">
      <Composition
        id="StratoProScore"
        component={StratoProScore}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ subtitles: true, musicVolume: 0.5 }}
      />
      <Still id="StratoProScoreThumbnail" component={ProScoreThumbnail} width={1920} height={1080} />
    </Folder>
    <Folder name="STRATO-Financia">
      <Composition
        id="StratoFinancia"
        component={StratoFinancia}
        durationInFrames={FINANCIA_FRAMES}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ subtitles: true, musicVolume: 0.5 }}
      />
      <Still id="StratoFinanciaThumbnail" component={FinanciaThumbnail} width={1920} height={1080} />
    </Folder>
    <Folder name="STRATO-Novo">
      <Composition
        id="StratoBemVindoNovo"
        component={BemVindoNovo}
        durationInFrames={NOVO_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ music: true }}
      />
    </Folder>
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
          slogan: "Veja o todo.",
          sloganAccent: "Decida com precisão.",
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
          slogan: "Veja o todo.",
          sloganAccent: "Decida com precisão.",
          cta: "Agende uma demonstração",
          contact: "",
        }}
      />
      <Still id="StratoThumbnail" component={Thumbnail} width={1920} height={1080} />
      <Still id="StratoLinkedInEmBreve" component={LinkedInComingSoon} width={1200} height={1200} />
    </Folder>
    </>
  );
};
