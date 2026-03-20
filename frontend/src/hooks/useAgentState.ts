import { useQuery } from "@tanstack/react-query";
import { wizardApi } from "@/lib/api";
import type { AgentState } from "@/context/types";

export function useAgentState(sessionId: string | null) {
  return useQuery<AgentState>({
    queryKey: ["agentState", sessionId],
    queryFn: () => wizardApi.getState(sessionId!) as Promise<AgentState>,
    enabled: !!sessionId,
    retry: false,
  });
}
