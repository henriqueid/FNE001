import "@fontsource-variable/urbanist";
import { Composition, continueRender, delayRender } from "remotion";
import { CopilotoExplainer, TOTAL_FRAMES } from "./Video";
import { MissaoStrato } from "./missao/Missao";
import { MISSAO_FRAMES } from "./missao/timeline";
import { FPS } from "./theme";

// Garante que a Urbanist esteja carregada antes do primeiro frame.
const fontHandle = delayRender("Carregando Urbanist");
Promise.all([
  document.fonts.load('500 32px "Urbanist Variable"'),
  document.fonts.load('800 32px "Urbanist Variable"'),
])
  .catch(() => undefined)
  .then(() => continueRender(fontHandle));

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="CopilotoExplainer"
        component={CopilotoExplainer}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="MissaoStrato16x9"
        component={MissaoStrato}
        durationInFrames={MISSAO_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="MissaoStrato9x16"
        component={MissaoStrato}
        durationInFrames={MISSAO_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
}
