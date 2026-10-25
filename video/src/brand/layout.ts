import { useVideoConfig } from "remotion";

// Escala tudo a partir da largura de referência (1920 no horizontal, 1080 no vertical).
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const unit = vertical ? width / 1080 : width / 1920;
  return { width, height, vertical, u: (px: number) => px * unit };
};
