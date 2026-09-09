import { useMutation } from "@tanstack/react-query";
import { getAiApiUrl } from "~/lib/constants";
import { useShallowAuthStore } from "~/lib/state/auth";

export interface CodeGenerationParams {
  widget_uuid: string;
  user_prompt: string;
  current_code?: string | null;
  language: "sql" | "python" | "text";
  sql_schema?: Record<string, unknown> | null;
  data_sample?: Record<string, unknown>[] | null;
  semantic_models?: { semantic_view: string }[] | null;
}

export interface CodeGenerationResponse {
  generated_code?: string | null;
}

async function generateCode(
  params: CodeGenerationParams,
  token: string | undefined,
): Promise<CodeGenerationResponse> {
  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`${getAiApiUrl()}/v1/generate/code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let message = `Code generation failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) message = body.detail;
    } catch {
      // response wasn't JSON — fall through with generic message
    }
    throw new Error(message);
  }

  return response.json();
}

export function useCodeGeneration() {
  const userToken = useShallowAuthStore((s) => s.user?.token);

  return useMutation({
    mutationFn: (params: CodeGenerationParams) => generateCode(params, userToken),
  });
}
