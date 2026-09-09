import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createWorkspaceMcpToken,
  listWorkspaceMcpTokens,
  revokeWorkspaceMcpToken,
} from "~/api/workspaceBridge.api";
import queryClient from "~/queryClient";

const MCP_TOKENS_KEY = ["workspace-mcp-tokens"] as const;

export function useMcpTokens() {
  return useQuery({ queryKey: MCP_TOKENS_KEY, queryFn: listWorkspaceMcpTokens });
}

export function invalidateMcpTokens() {
  queryClient.invalidateQueries({ queryKey: MCP_TOKENS_KEY });
}

export function useCreateMcpToken() {
  return useMutation({
    mutationFn: (name: string) => createWorkspaceMcpToken(name),
    onSuccess: invalidateMcpTokens,
  });
}

export function useDeleteMcpToken() {
  return useMutation({
    mutationFn: (uuid: string) => revokeWorkspaceMcpToken(uuid),
    onSuccess: invalidateMcpTokens,
  });
}
