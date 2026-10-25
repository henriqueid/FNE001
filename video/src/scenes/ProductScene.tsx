import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { Chapter } from "../components/Chapter";
import { type CameraKey, type Mark, ProductShot, type ShotImage } from "../components/ProductShot";

// Cena de produto padrão: indicador de etapa, print com câmera e destaques, legenda.
export const ProductScene: React.FC<{
  chapter: number;
  totalChapters: number;
  chapterLabel: string;
  images: ShotImage[];
  camera: CameraKey[];
  marks?: Mark[];
  eyebrow: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
}> = ({ chapter, totalChapters, chapterLabel, images, camera, marks, eyebrow, title, body, children }) => (
  <AbsoluteFill>
    <ProductShot images={images} camera={camera} marks={marks}>
      {children}
    </ProductShot>
    <Chapter index={chapter} total={totalChapters} label={chapterLabel} />
    <Caption eyebrow={eyebrow} title={title} body={body} />
  </AbsoluteFill>
);
