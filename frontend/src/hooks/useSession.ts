import { useEffect } from "react";
import { useWizard } from "@/context/WizardContext";
import { useSessionDict } from "@/context/SessionContext";

/**
 * Bridge hook: keeps WizardContext.sessionId in sync with SessionContext.session_id.
 * - On mount: if SessionContext already has an insta_* session_id (from localStorage),
 *   push it into WizardContext so useCampaign can use it immediately.
 * - If no session_id yet, generate a temporary UUID for WizardContext
 *   (will be replaced when ensureSessionId() fires on first "Next" click).
 */
export function useSession(): string | null {
  const { state, dispatch } = useWizard();
  const session = useSessionDict();

  useEffect(() => {
    const newId = session.data.session_id;
    if (newId && newId !== state.sessionId) {
      dispatch({ type: "INIT_SESSION", sessionId: newId });
    } else if (!state.sessionId && !newId) {
      // Temporary ID until ensureSessionId() generates the real one
      const tempId = crypto.randomUUID();
      dispatch({ type: "INIT_SESSION", sessionId: tempId });
    }
  }, [session.data.session_id, state.sessionId, dispatch]);

  return state.sessionId;
}
