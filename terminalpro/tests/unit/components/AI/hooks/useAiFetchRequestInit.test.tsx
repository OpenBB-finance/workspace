import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const allWidget = {
    uuid: "global-widget",
    widget_id: "global_widget",
    name: "Global Widget",
    description: "Global widget description",
    origin: "OpenBB Sandbox",
    params: [],
  };
  const selectedCopilot = {
    id: "openbb-copilot",
    name: "OpenBB Copilot",
    endpoints: { query: "https://ada.example/v1/query" },
    features: {
      "widget-global-search": true,
      "generative-ui": true,
      "mcp-tools": false,
      "agent-orchestration": false,
    },
  };

  return {
    allWidget,
    selectedCopilot,
    extraWidgetsEnabled: false,
    generativeUiEnabled: true,
    temporaryWidgets: [] as any[],
  };
});

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "dashboard-1" }) }));
vi.mock("~/components/AI/Artifact", () => ({ isSnowflakeArtifact: () => false }));
vi.mock("~/components/AI/hooks/useGetCopilotRequestHeaders", () => ({
  useGetCopilotRequestHeaders: () => () => ({ Authorization: "Bearer token" }),
}));
vi.mock("~/components/AI/hooks/useGetCustomApiKeys", () => ({
  useGetCustomApiKeys: () => () => ({}),
}));
vi.mock("~/components/AI/hooks/useGetFinalMessagesAndWidgets", () => ({
  useGetFinalMessagesAndWidgets: () => async () => ({
    finalMessages: [{ role: "human", content: "hello" }],
    finalDashboardWidgets: [],
    mentionWidgets: [],
  }),
}));
vi.mock("~/lib/constants", () => ({
  ALL_AI_FEATURES: new Set([
    "widget-global-search",
    "generative-ui",
    "mcp-tools",
    "agent-orchestration",
  ]),
  getAiApiUrl: () => "https://ada.example",
  getDefaultCopilot: () => mockState.selectedCopilot,
  MAX_COPILOT_LINKS: 4,
}));
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: (state: any) => any) =>
    selector({ user: { token: "token" } }),
}));
vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: (state: any) => any) =>
    selector({ semanticViews: undefined }),
}));
vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: (state: any) => any) =>
    selector({
      selectedCopilot: mockState.selectedCopilot,
      getCurrentChat: () => ({ id: "chat-1" }),
      getCurrentChatArtifacts: () => [],
      customFeatureStates: {},
      orchestrationModeEnabled: false,
    }),
}));
vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (selector: (state: any) => any) =>
    selector({
      widgetSubsetData: [],
      extraWidgetsEnabled: mockState.extraWidgetsEnabled,
      generativeUiEnabled: mockState.generativeUiEnabled,
      copilotWidgetsLastUpdated: 0,
      getCopilotWidgets: () => ({
        selectedWidgets: [],
        temporaryWidgets: mockState.temporaryWidgets,
        allWidgets: [mockState.allWidget],
        workspaceState: {
          agents: [],
          action_history: [],
          current_dashboard_uuid: "dashboard-1",
          current_dashboard_info: null,
          current_page_context: "dashboard",
        },
      }),
    }),
}));
vi.mock("~/lib/state/mcpTools", () => ({
  useShallowMcpToolsStore: (selector: (state: any) => any) =>
    selector({
      getEnabledToolsForAgent: vi.fn(async () => []),
      getEnabledToolCount: () => 0,
    }),
}));
vi.mock("~/lib/state/skillsLibrary", () => ({
  useShallowSkillsLibraryStore: (selector: (state: any) => any) =>
    selector({
      getSkillsCatalog: () => [],
      getSkillBySlug: () => undefined,
      skills: [],
    }),
}));
vi.mock("~/lib/utils", () => ({ extractUrlsFromText: () => [] }));

import { useAiFetchRequestInit } from "~/components/AI/hooks/useAiFetchRequestInit";

async function getPayloads() {
  const { result } = renderHook(() => useAiFetchRequestInit());
  const [getQueryFetchParams, getFunctionCallFetchParams] = result.current;
  const abortSignal = new AbortController().signal;

  const queryParams = await getQueryFetchParams({
    incomingMessage: "hello",
    abortSignal,
  });
  const functionCallParams = await getFunctionCallFetchParams({
    xHeaders: {},
    abortSignal,
  });

  return [
    JSON.parse(queryParams.init.body as string),
    JSON.parse(functionCallParams.init.body as string),
  ];
}

// Chat attachments become temporary widgets without a `uuid` (only `widget_id`),
// mirroring useGetCopilotWidgets' temporaryWidgets.
const makeAttachmentWidget = (uuid: string, name: string) => ({
  origin: "OpenBB Hub",
  widget_id: `file-${uuid}`,
  name,
  description: name,
  params: [],
  metadata: { extension: name.split(".").pop() },
});

describe("useAiFetchRequestInit", () => {
  beforeEach(() => {
    mockState.extraWidgetsEnabled = false;
    mockState.generativeUiEnabled = true;
    mockState.temporaryWidgets = [];
  });

  it("does not send extra widgets when only Generative UI is enabled", async () => {
    const payloads = await getPayloads();

    for (const payload of payloads) {
      expect(payload.workspace_options["generative-ui"]).toBe(true);
      expect(payload.workspace_options["widget-global-search"]).toBeUndefined();
      expect(payload.widgets.extra).toEqual([]);
    }
  });

  it("sends extra widgets when Global data is enabled", async () => {
    mockState.extraWidgetsEnabled = true;

    const payloads = await getPayloads();

    for (const payload of payloads) {
      expect(payload.workspace_options["widget-global-search"]).toBe(true);
      expect(payload.widgets.extra).toEqual([mockState.allWidget]);
    }
  });

  it("keeps every attached file widget in primary, not just the first", async () => {
    mockState.temporaryWidgets = [
      makeAttachmentWidget("2f462215-70da-40a5-a015-966f806113d4", "logs.csv"),
      makeAttachmentWidget("5a45b381-d941-48c0-b095-64328ba88c40", "photo1.jpg"),
      makeAttachmentWidget("7c11d0aa-3b2f-4d6e-9c8b-2f0e5a1b4c6d", "photo2.jpg"),
    ];

    const payloads = await getPayloads();

    for (const payload of payloads) {
      const primaryIds = payload.widgets.primary.map(
        (w: { widget_id: string }) => w.widget_id,
      );
      expect(primaryIds).toEqual([
        "file-2f462215-70da-40a5-a015-966f806113d4",
        "file-5a45b381-d941-48c0-b095-64328ba88c40",
        "file-7c11d0aa-3b2f-4d6e-9c8b-2f0e5a1b4c6d",
      ]);
    }
  });
});
