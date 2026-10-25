import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const fontsReady = loadFont({
  family: "Urbanist",
  url: staticFile("Urbanist.woff2"),
  weight: "100 900",
});
