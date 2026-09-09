import { z } from "zod";

export const appMetadataSchema = {
  name: z.string().min(1, "App name is required"),
  description: z.string().min(1, "App description is required"),
  imageUrl: z.string().optional(),
  prompts: z.array(z.object({ value: z.string() })).optional(),
};

export const appMetadataObjectSchema = z.object(appMetadataSchema);

export type AppMetadataForm = z.infer<typeof appMetadataObjectSchema>;

export const PREVIEW_DESCRIPTION_FALLBACK =
  "Add a description so others know what this app is for.";

export function trimPrompts(prompts: AppMetadataForm["prompts"]): string[] {
  return (prompts ?? [])
    .map((p) => (p?.value ?? "").trim())
    .filter((p) => p.length > 0);
}
