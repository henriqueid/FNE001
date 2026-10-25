import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { Chapter } from "../components/Chapter";
import { ProductStage } from "../components/ProductStage";

// Cena de produto padrão: indicador de etapa, janela com câmera e legenda.
export const ProductScene: React.FC<{
  chapter: number;
  totalChapters: number;
  chapterLabel: string;
  windowTitle: string;
  focus: [number, number];
  eyebrow: string;
  title: string;
  body?: string;
  children: React.ReactNode;
}> = ({ chapter, totalChapters, chapterLabel, windowTitle, focus, eyebrow, title, body, children }) => (
  <AbsoluteFill>
    <ProductStage title={windowTitle} focus={focus}>
      {children}
    </ProductStage>
    <Chapter index={chapter} total={totalChapters} label={chapterLabel} />
    <Caption eyebrow={eyebrow} title={title} body={body} />
  </AbsoluteFill>
);
