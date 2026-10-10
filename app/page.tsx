import StratoApp from "@/src/app/strato-app";
import { AuthGate } from "@/src/features/auth/auth-gate";

/** Rota única: toda a navegação entre módulos acontece no cliente (ver src/app/strato-app.tsx). */
export default function Home() {
  return (
    <AuthGate>
      <StratoApp />
    </AuthGate>
  );
}
