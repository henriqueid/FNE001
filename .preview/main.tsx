// Pré-visualização sem Next/vinext: monta o app direto no Vite (npm run preview:vite).
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import StratoApp from "../src/app/strato-app";

createRoot(document.getElementById("root")!).render(<StratoApp />);
