import { Outlet } from "react-router-dom";
import { WizardNav } from "./WizardNav";
import { Sidebar } from "./Sidebar";
import { StepIndicator } from "./StepIndicator";
import { useSession } from "@/hooks/useSession";

export function WizardLayout() {
  useSession();

  return (
    <>
      <WizardNav />
      <StepIndicator />
      <div className="flex min-h-[calc(100vh-63px)] relative z-[1]">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-9 max-h-[calc(100vh-63px)] scroll-smooth">
          <Outlet />
        </main>
      </div>
    </>
  );
}
