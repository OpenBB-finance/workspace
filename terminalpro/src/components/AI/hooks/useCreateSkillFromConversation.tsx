import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { createUserSkill } from "~/api/auth.api";
import {
  MAX_SKILL_CONVERSATION_MESSAGE_CHARS,
  MAX_SKILL_CONVERSATION_TOTAL_CHARS,
  MAX_SKILL_DESCRIPTION_LENGTH,
} from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type AIMessage,
  type CopilotCommandResultT,
  type HumanMessage,
  useCopilotStore,
} from "~/lib/state/copilot";
import { toSlug, useSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import { ensureUniqueSlug, type SaveSkillInputArgumentsT } from "~/lib/utils";
import type { SkillCreate } from "~/types/auth.type";

interface GeneratedSkill {
  slug: string;
  description: string;
  content: string;
}

/**
 * Serialize the visible conversation for the skill generation endpoint,
 * keeping the newest whole messages that fit within the payload budget.
 */
function buildConversationPayload() {
  const { messages } = useCopilotStore.getState().getCurrentChat();
  const visible = messages.filter(
    (m): m is HumanMessage | AIMessage =>
      (m.role === "human" || m.role === "ai") &&
      !m.isHidden &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );

  const kept: { role: "human" | "ai"; content: string }[] = [];
  let used = 0;
  for (let i = visible.length - 1; i >= 0; i--) {
    const content = visible[i].content.slice(0, MAX_SKILL_CONVERSATION_MESSAGE_CHARS);
    if (used + content.length > MAX_SKILL_CONVERSATION_TOTAL_CHARS && kept.length > 0) {
      break;
    }
    kept.push({ role: visible[i].role, content });
    used += content.length;
  }
  return kept.reverse();
}

/**
 * Handles the `save_skill` copilot function call: generates skill metadata and
 * content from the current conversation via the AI backend, saves it to the
 * user's skill library, and shows a toast with an "Edit Skill" action.
 * Mirrors the "create widget from artifact" flow.
 */
export function useCreateSkillFromConversation() {
  const userToken = useShallowAuthStore((s) => s.user?.token);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSkillInfo = useCallback(
    async (
      args: SaveSkillInputArgumentsT,
      existingSlugs: string[],
      signal: AbortSignal,
    ): Promise<GeneratedSkill> => {
      const response = await fetch(`${getConfig().urls.ai}/v1/generate/skill_info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        } as HeadersInit,
        body: JSON.stringify({
          skill_generation_request: {
            conversation: buildConversationPayload(),
            name_hint: args.name || undefined,
            instructions: args.instructions || undefined,
            existing_slugs: existingSlugs,
          },
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Skill generation failed with status ${response.status}`);
      }

      // Validate the response shape instead of trusting the cast.
      const data = (await response.json()) as Partial<
        Record<keyof GeneratedSkill, unknown>
      >;
      return {
        slug: typeof data.slug === "string" ? data.slug : "",
        description: typeof data.description === "string" ? data.description : "",
        content: typeof data.content === "string" ? data.content : "",
      };
    },
    [userToken],
  );

  const createSkillFromConversation = useCallback(
    async (args: SaveSkillInputArgumentsT): Promise<CopilotCommandResultT[]> => {
      // Deployment-level kill switch. Gate before any work so a copilot that
      // supports `save_skill` can't send the conversation to the AI service on
      // a deployment that has the feature turned off.
      const { enabled, saveSkillFromChat } = getConfig().copilot;
      if (!(enabled && saveSkillFromChat)) {
        return [
          {
            status: "error",
            message: "Saving skills is not available in this deployment. Do not retry.",
          },
        ];
      }

      const {
        isSlugUnique,
        updateSkills,
        setSkillDialogOpen,
        openSkillDialogWithPrefill,
      } = useSkillsLibraryStore.getState();

      abortControllerRef.current = new AbortController();
      let editRequested = false;
      const toastId = toast.loading("Saving skill...", {
        style: { pointerEvents: "auto" },
        cancel: {
          label: "Edit Skill",
          onClick: () => {
            editRequested = true;
            abortControllerRef.current?.abort();
            toast.dismiss(toastId);
            openSkillDialogWithPrefill({
              slug: toSlug(args.name || ""),
              content: args.instructions || "",
            });
          },
        },
      });

      try {
        const generated = await fetchSkillInfo(
          args,
          useSkillsLibraryStore.getState().skills.map((s) => s.slug),
          abortControllerRef.current.signal,
        );
        // The user may click "Edit Skill" after generation resolves but before
        // the save; bail out so we don't save a duplicate behind the dialog.
        if (abortControllerRef.current?.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const baseSlug =
          toSlug(generated.slug) || toSlug(args.name || "") || "saved-skill";
        const slug = ensureUniqueSlug(
          baseSlug.length >= 2 ? baseSlug : "saved-skill",
          isSlugUnique,
        );
        const payload: SkillCreate = {
          slug,
          description: (
            generated.description || "Workflow saved from a copilot conversation."
          ).slice(0, MAX_SKILL_DESCRIPTION_LENGTH),
          content: generated.content,
        };
        if (!payload.content) {
          throw new Error("Skill generation returned empty content");
        }

        const updatedSkills = await createUserSkill(payload);
        if (!updatedSkills) {
          throw new Error("Failed to save the skill to your library");
        }
        updateSkills(updatedSkills);
        const savedSkill = updatedSkills.find((s) => s.slug === slug);

        toast.success(`Skill saved: /${slug}`, {
          id: toastId,
          description: <div className="mb-2">{payload.description}</div>,
          style: { pointerEvents: "auto" },
          ...(savedSkill && {
            cancel: {
              label: "Edit Skill",
              onClick: () => setSkillDialogOpen(savedSkill.id),
            },
          }),
        });

        return [
          {
            status: "success",
            data: { skill: { slug, description: payload.description } },
          },
        ];
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return [
            {
              status: "success",
              message: editRequested
                ? "The user chose to review and save the skill manually; the skill editor was opened with prefilled values. Do not retry."
                : "Skill saving was cancelled by the user. Do not retry.",
            },
          ];
        }
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        toast.error("Failed to save skill", {
          id: toastId,
          description: errorMessage,
        });
        return [{ status: "error", message: errorMessage }];
      }
    },
    [fetchSkillInfo],
  );

  return createSkillFromConversation;
}
