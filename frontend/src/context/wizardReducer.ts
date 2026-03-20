export interface WizardState {
  currentStep: number;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sessionId: string | null;
}

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_STREAMING"; streaming: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "INIT_SESSION"; sessionId: string };

export const initialWizardState: WizardState = {
  currentStep: 1,
  isLoading: false,
  isStreaming: false,
  error: null,
  sessionId: null,
};

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step, error: null };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_STREAMING":
      return { ...state, isStreaming: action.streaming };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "INIT_SESSION":
      return { ...state, sessionId: action.sessionId };
    default:
      return state;
  }
}
