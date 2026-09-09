import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateSkillFromConversation } from "~/components/AI/hooks/useCreateSkillFromConversation";
import { isDefaultSkill } from "~/components/AI/skills";
import {
  type Chat,
  type CopilotCommandResultT,
  useCopilotStore,
} from "~/lib/state/copilot";
import { useSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import type { Skill, SkillCreate } from "~/types/auth.type";
import { mockConfig } from "../../../../mocks/runtimeConfig";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
  },
}));

// Mock API
const mockCreateUserSkill = vi.fn();
vi.mock("~/api/auth.api", () => ({
  createUserSkill: (...args: unknown[]) => mockCreateUserSkill(...args),
}));

// Mock auth store
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: (state: { user: { token: string } }) => unknown) =>
    selector({ user: { token: "test-token" } }),
}));

// Stub the theme store so the skills store does not pull in real persisted state.
vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: () => ({
      removedSkillSlugs: ["openbb-html-report", "snowflake-html-report"],
      removeDefaultSkill: vi.fn(),
    }),
  },
}));

/**
 * Saving a skill runs it through `updateSkills`, which always appends the built-in
 * default skills. Filter them out so slug assertions stay exact as defaults change.
 */
const savedSkillSlugs = () =>
  useSkillsLibraryStore
    .getState()
    .skills.filter((skill) => !isDefaultSkill(skill.id))
    .map((skill) => skill.slug);

// Mock fetch for the skill generation endpoint
global.fetch = vi.fn();

// In browsers DOMException inherits from Error, but jsdom's DOMException comes
// from another realm so `instanceof Error` fails. Shim it to match browsers so
// the hook's AbortError handling behaves as it does in production.
class TestDOMException extends Error {
  constructor(message?: string, name?: string) {
    super(message);
    this.name = name ?? "Error";
  }
}
vi.stubGlobal("DOMException", TestDOMException);

const CHAT_CREATED_AT = 1710000000000;

const generatedResponse = {
  slug: "quarterly-analysis",
  description: "Analyzes quarterly earnings",
  content: "# Quarterly analysis\n\n1. Pull the income statement",
};

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: "skill-1",
  slug: "existing-skill",
  description: "An existing skill",
  content: "# Existing",
  createdDate: "2026-01-01T00:00:00Z",
  updatedDate: "2026-01-01T00:00:00Z",
  ...overrides,
});

const mockChat: Chat = {
  id: "chat-1",
  createdAt: CHAT_CREATED_AT,
  label: "Test chat",
  lastOpened: CHAT_CREATED_AT,
  messages: [
    {
      role: "human",
      content: "How do I analyze earnings?",
      timestamp: 1,
      copilotId: "openbb-copilot",
    },
    {
      role: "ai",
      content: "Start with the income statement.",
      timestamp: 2,
      copilotId: "openbb-copilot",
    },
    {
      role: "ai",
      content: "hidden reasoning",
      timestamp: 3,
      copilotId: "openbb-copilot",
      isHidden: true,
    },
    {
      role: "tool",
      data: [],
      timestamp: 4,
      copilotId: "openbb-copilot",
      function: "get_widget_data",
      input_arguments: { data_sources: [] },
      extra_state: {},
    },
  ],
};

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
const toastLoadingMock = toast.loading as ReturnType<typeof vi.fn>;

async function runHook(
  args: Parameters<ReturnType<typeof useCreateSkillFromConversation>>[0],
) {
  const { result } = renderHook(() => useCreateSkillFromConversation());
  let commandResult: CopilotCommandResultT[] = [];
  await act(async () => {
    commandResult = await result.current(args);
  });
  return commandResult;
}

describe("useCreateSkillFromConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastLoadingMock.mockReturnValue("toast-id");
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(generatedResponse),
    });
    mockCreateUserSkill.mockImplementation(async (payload: SkillCreate) => [
      makeSkill({ id: "skill-new", ...payload }),
    ]);
    useSkillsLibraryStore.setState({
      skills: [],
      skillDialogOpen: false,
      skillDialogPrefill: null,
    });
    useCopilotStore.setState({ chats: [mockChat], currentChat: CHAT_CREATED_AT });
    mockConfig.copilot.enabled = true;
    mockConfig.copilot.saveSkillFromChat = true;
  });

  describe("happy path", () => {
    it("generates a skill from the visible conversation and saves it", async () => {
      const commandResult = await runHook({
        name: "Quarterly analysis",
        instructions: "Focus on earnings",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3000/ai/v1/generate/skill_info");
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer test-token",
      );
      const body = JSON.parse(init.body as string);
      expect(body.skill_generation_request).toEqual({
        conversation: [
          { role: "human", content: "How do I analyze earnings?" },
          { role: "ai", content: "Start with the income statement." },
        ],
        name_hint: "Quarterly analysis",
        instructions: "Focus on earnings",
        existing_slugs: [],
      });

      expect(mockCreateUserSkill).toHaveBeenCalledWith({
        slug: "quarterly-analysis",
        description: "Analyzes quarterly earnings",
        content: generatedResponse.content,
      });
      expect(savedSkillSlugs()).toEqual(["quarterly-analysis"]);
      expect(commandResult).toEqual([
        {
          status: "success",
          data: {
            skill: {
              slug: "quarterly-analysis",
              description: "Analyzes quarterly earnings",
            },
          },
        },
      ]);
      expect(toast.success).toHaveBeenCalledWith(
        "Skill saved: /quarterly-analysis",
        expect.objectContaining({ id: "toast-id" }),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("generation failures", () => {
    it("returns an error result when the generation API responds non-OK", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const commandResult = await runHook({});

      expect(commandResult).toEqual([
        { status: "error", message: "Skill generation failed with status 500" },
      ]);
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to save skill",
        expect.objectContaining({
          id: "toast-id",
          description: "Skill generation failed with status 500",
        }),
      );
      expect(mockCreateUserSkill).not.toHaveBeenCalled();
    });

    it("returns an error result when generation returns empty content", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ slug: "empty-skill", description: "d", content: "" }),
      });

      const commandResult = await runHook({});

      expect(commandResult).toEqual([
        { status: "error", message: "Skill generation returned empty content" },
      ]);
      expect(mockCreateUserSkill).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe("slug handling", () => {
    it("appends -2 when the generated slug collides with an existing skill", async () => {
      useSkillsLibraryStore.setState({
        skills: [makeSkill({ id: "skill-1", slug: "quarterly-analysis" })],
      });

      const commandResult = await runHook({});

      expect(mockCreateUserSkill).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "quarterly-analysis-2" }),
      );
      expect(commandResult).toEqual([
        {
          status: "success",
          data: { skill: expect.objectContaining({ slug: "quarterly-analysis-2" }) },
        },
      ]);
    });

    it("falls back to the name hint when the response has no usable slug", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ description: "d", content: "c" }),
      });

      await runHook({ name: "My Workflow" });

      expect(mockCreateUserSkill).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "my-workflow" }),
      );
    });

    it("falls back to saved-skill when neither slug nor name is usable", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: "c" }),
      });

      await runHook({});

      expect(mockCreateUserSkill).toHaveBeenCalledWith({
        slug: "saved-skill",
        description: "Workflow saved from a copilot conversation.",
        content: "c",
      });
    });
  });

  describe("Edit Skill cancel action", () => {
    it("opens the skill dialog with prefill when Edit Skill is clicked while generating", async () => {
      let capturedCancel: (() => void) | undefined;
      toastLoadingMock.mockImplementation((_message, options) => {
        capturedCancel = options?.cancel?.onClick;
        return "toast-id";
      });
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );

      const { result } = renderHook(() => useCreateSkillFromConversation());
      let promise!: Promise<CopilotCommandResultT[]>;
      act(() => {
        promise = result.current({ name: "My Workflow", instructions: "Do the thing" });
      });
      act(() => {
        capturedCancel?.();
      });
      const commandResult = await promise;

      expect(useSkillsLibraryStore.getState().skillDialogPrefill).toEqual({
        slug: "my-workflow",
        content: "Do the thing",
      });
      expect(useSkillsLibraryStore.getState().skillDialogOpen).toBe(true);
      expect(commandResult).toEqual([
        {
          status: "success",
          message: expect.stringContaining("save the skill manually"),
        },
      ]);
      expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
      expect(mockCreateUserSkill).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("does not save when Edit Skill is clicked right as generation resolves", async () => {
      let capturedCancel: (() => void) | undefined;
      toastLoadingMock.mockImplementation((_message, options) => {
        capturedCancel = options?.cancel?.onClick;
        return "toast-id";
      });
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => {
          // Simulate the user clicking Edit Skill just as generation resolves
          capturedCancel?.();
          return generatedResponse;
        },
      });

      const commandResult = await runHook({});

      expect(mockCreateUserSkill).not.toHaveBeenCalled();
      expect(commandResult).toEqual([
        {
          status: "success",
          message: expect.stringContaining("save the skill manually"),
        },
      ]);
      expect(useSkillsLibraryStore.getState().skillDialogOpen).toBe(true);
    });
  });

  describe("feature flag", () => {
    it("never reaches the AI service when saveSkillFromChat is disabled", async () => {
      mockConfig.copilot.saveSkillFromChat = false;

      const commandResult = await runHook({ name: "Quarterly analysis" });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockCreateUserSkill).not.toHaveBeenCalled();
      expect(toast.loading).not.toHaveBeenCalled();
      expect(commandResult).toEqual([
        {
          status: "error",
          message: expect.stringContaining("Do not retry"),
        },
      ]);
    });

    it("is disabled when the copilot itself is disabled", async () => {
      mockConfig.copilot.enabled = false;

      const commandResult = await runHook({ name: "Quarterly analysis" });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(commandResult[0].status).toBe("error");
    });
  });
});
