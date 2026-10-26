import { useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../../brand/tokens";
import { GLOBAL_CAPTIONS } from "../data/scenes";

// Legendas abertas do vídeo STRATO × Financia (mesmos tempos do arquivo SRT).
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = GLOBAL_CAPTIONS.find(c => t >= c.start && t <= c.end + 0.15);
  if (!cue) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "10px 22px",
          borderRadius: 12,
          background: "rgba(2, 6, 23, 0.72)",
          color: colors.white,
          fontSize: 29,
          fontWeight: 500,
          lineHeight: 1.32,
          textAlign: "center",
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};
