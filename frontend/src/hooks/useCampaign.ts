import { useMutation, useQueryClient } from "@tanstack/react-query";
import { wizardApi } from "@/lib/api";
import { useWizard } from "@/context/WizardContext";

export function useCampaign() {
  const { state, dispatch } = useWizard();
  const queryClient = useQueryClient();

  const submitStep = useMutation({
    mutationFn: ({ step, data }: { step: number; data: unknown }) =>
      wizardApi.submitStep(state.sessionId!, step, data),
    onMutate: () => dispatch({ type: "SET_LOADING", loading: true }),
    onSuccess: (_res, { step }) => {
      dispatch({ type: "SET_LOADING", loading: false });
      dispatch({ type: "SET_STEP", step: step + 1 });
      queryClient.invalidateQueries({ queryKey: ["agentState"] });
    },
    onError: (err: Error) =>
      dispatch({ type: "SET_ERROR", error: err.message }),
  });

  const approve = useMutation({
    mutationFn: () => wizardApi.resume(state.sessionId!, true),
    onSuccess: () => {
      dispatch({ type: "SET_STEP", step: 6 });
      queryClient.invalidateQueries({ queryKey: ["agentState"] });
    },
    onError: (err: Error) =>
      dispatch({ type: "SET_ERROR", error: err.message }),
  });

  return { submitStep, approve };
}
