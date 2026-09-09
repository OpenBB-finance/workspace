import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentManagement } from "~/components/AI/hooks/useAgentManagement";

// --- Hoisted mocks ---
const {
  mockFetchAgentsData,
  mockHasCopilotConflict,
  mockPutCustomCopilot,
  mockRemoveCustomCopilot,
  mockToast,
  mockSetSelectedCopilot,
  mockSetExternalCopilotHolders,
  mockUpdateExternalCopilotHolders,
} = vi.hoisted(() => ({
  mockFetchAgentsData: vi.fn(),
  mockHasCopilotConflict: vi.fn(),
  mockPutCustomCopilot: vi.fn(),
  mockRemoveCustomCopilot: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockSetSelectedCopilot: vi.fn(),
  mockSetExternalCopilotHolders: vi.fn(),
  mockUpdateExternalCopilotHolders: vi.fn(),
}));

vi.mock("~/api/auth.api", () => ({
  fetchAgentsData: (...args: unknown[]) => mockFetchAgentsData(...args),
  hasCopilotConflict: (...args: unknown[]) => mockHasCopilotConflict(...args),
  putCustomCopilot: (...args: unknown[]) => mockPutCustomCopilot(...args),
  removeCustomCopilot: (...args: unknown[]) => mockRemoveCustomCopilot(...args),
}));

vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("usehooks-ts", () => ({ useDebounceValue: (value: string) => [value] }));

interface CopilotMock {
  id: string;
  name: string;
  description: string;
  holderUuid?: string;
  endpoints: Record<string, string>;
  headers?: Record<string, string>;
}

interface ExternalCopilotHolderMock {
  uuid: string;
  url: string;
  headers: Record<string, string>;
  copilots?: CopilotMock[];
  status?: "success" | "error";
}

let mockSelectedCopilot: CopilotMock | null = null;

const mockCopilotStoreState: {
  externalCopilotHolders: ExternalCopilotHolderMock[];
  setExternalCopilotHolders: ReturnType<typeof vi.fn>;
  updateExternalCopilotHolders: ReturnType<typeof vi.fn>;
} = {
  externalCopilotHolders: [],
  setExternalCopilotHolders: mockSetExternalCopilotHolders,
  updateExternalCopilotHolders: mockUpdateExternalCopilotHolders,
};

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: Function) =>
    selector({
      externalCopilotHolders: mockCopilotStoreState.externalCopilotHolders,
      selectedCopilot: mockSelectedCopilot,
      setSelectedCopilot: mockSetSelectedCopilot,
    }),
  useCopilotStore: { getState: () => mockCopilotStoreState },
}));

vi.mock("~/hooks/useStateReducer", async () => {
  const { useState: useStateReal, useCallback: useCallbackReal } = await import(
    "react"
  );
  return {
    useStateReducer: <T extends Record<string, unknown>>(initialState: T) => {
      const [state, setState] = useStateReal(initialState);
      const dispatch = useCallbackReal(
        (partial: Partial<{ [K in keyof T]: T[K] | ((prev: T[K]) => T[K]) }>) => {
          setState((prev: T) => {
            const next = { ...prev };
            for (const key of Object.keys(partial) as (keyof T)[]) {
              const val = partial[key];
              if (typeof val === "function") {
                next[key] = (val as (prev: T[keyof T]) => T[keyof T])(prev[key]);
              } else {
                next[key] = val as T[keyof T];
              }
            }
            return next;
          });
        },
        [],
      );
      return [state, dispatch] as const;
    },
  };
});

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    DEFAULT_COPILOT: {
      id: "openbb-copilot",
      name: "OpenBB Copilot",
      description: "Default",
      endpoints: {},
    },
  };
});

vi.mock("~/lib/utils/widgetParams", () => ({
  createURLString: (path: string, base: string) => `${base}${path}`,
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: Function) =>
    selector({ setShowAddAgentsDialog: vi.fn() }),
}));

// --- Factories ---

function makeCopilot(overrides: Partial<CopilotMock> = {}): CopilotMock {
  return {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent",
    holderUuid: "holder-1",
    endpoints: { query: "/api/query" },
    headers: {},
    ...overrides,
  };
}

function makeHolder(
  overrides: Partial<ExternalCopilotHolderMock> = {},
): ExternalCopilotHolderMock {
  return {
    uuid: "holder-1",
    url: "https://agents.example.com",
    headers: {},
    copilots: [makeCopilot()],
    status: "success",
    ...overrides,
  };
}

// --- Tests ---

describe("useAgentManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopilotStoreState.externalCopilotHolders = [];
    mockSelectedCopilot = null;
    mockPutCustomCopilot.mockResolvedValue(undefined);
    mockRemoveCustomCopilot.mockResolvedValue(undefined);
    mockHasCopilotConflict.mockReturnValue(false);
  });

  it("syncs groups from externalCopilotHolders on mount", async () => {
    const holder = makeHolder();
    mockCopilotStoreState.externalCopilotHolders = [holder];

    const { result } = renderHook(() => useAgentManagement());

    expect(result.current.state.groups).toHaveLength(1);
    expect(result.current.state.groups[0].uuid).toBe("holder-1");
    expect(result.current.state.groups[0].url).toBe("https://agents.example.com");
  });

  describe("handleSaveRefresh", () => {
    it("fetches agents and persists on success", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const freshCopilots = [
        makeCopilot({ id: "agent-refreshed", name: "Refreshed Agent" }),
      ];
      mockFetchAgentsData.mockResolvedValue(freshCopilots);

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleSaveRefresh("holder-1");
      });

      expect(mockFetchAgentsData).toHaveBeenCalledWith(holder);
      expect(mockPutCustomCopilot).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Agents refreshed successfully", {
        id: "refresh-holder-1",
      });
    });

    it("shows error toast when fetchAgentsData rejects", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      mockFetchAgentsData.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleSaveRefresh("holder-1");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed to refresh agents", {
        id: "refresh-holder-1",
        description: "Network error",
      });
    });

    it("aborts when hasCopilotConflict returns true", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const freshCopilots = [makeCopilot({ id: "agent-conflict" })];
      mockFetchAgentsData.mockResolvedValue(freshCopilots);
      mockHasCopilotConflict.mockReturnValue(true);

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleSaveRefresh("holder-1");
      });

      expect(mockPutCustomCopilot).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("reads fresh state from the store after the async fetch", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const holder2 = makeHolder({
        uuid: "holder-2",
        url: "https://other.example.com",
        copilots: [makeCopilot({ id: "agent-2", holderUuid: "holder-2" })],
      });
      const freshCopilots = [makeCopilot({ id: "agent-refreshed" })];

      mockFetchAgentsData.mockImplementation(async () => {
        // Simulate state change during the async operation
        mockCopilotStoreState.externalCopilotHolders = [holder, holder2];
        return freshCopilots;
      });

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleSaveRefresh("holder-1");
      });

      // hasCopilotConflict should have been called with copilots from the FRESH state
      // (which includes holder2's copilots), filtered to exclude holder-1's agents
      expect(mockHasCopilotConflict).toHaveBeenCalledTimes(1);
      const [, existingCopilots] = mockHasCopilotConflict.mock.calls[0];
      // The fresh state has holder2, whose agent has holderUuid "holder-2" (not "holder-1"),
      // so it should be included in existingCopilots
      expect(existingCopilots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "agent-2", holderUuid: "holder-2" }),
        ]),
      );
    });
  });

  describe("handleRefreshAll", () => {
    it("refreshes every holder silently and shows one success toast", async () => {
      mockCopilotStoreState.externalCopilotHolders = [
        makeHolder({ uuid: "holder-1" }),
        makeHolder({ uuid: "holder-2", url: "https://other.example.com" }),
      ];
      mockFetchAgentsData.mockResolvedValue([makeCopilot()]);

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleRefreshAll();
      });

      expect(mockFetchAgentsData).toHaveBeenCalledTimes(2);
      expect(mockToast.success).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("Agents refreshed");
      // Per-holder toasts are suppressed during a bulk refresh.
      expect(mockToast.success).not.toHaveBeenCalledWith(
        "Agents refreshed successfully",
        expect.anything(),
      );
      expect(result.current.isRefreshing).toBe(false);
    });

    it("reports the number of failed holders", async () => {
      mockCopilotStoreState.externalCopilotHolders = [
        makeHolder({ uuid: "holder-1" }),
        makeHolder({ uuid: "holder-2", url: "https://other.example.com" }),
      ];
      mockFetchAgentsData.mockImplementation(
        async (holder: { uuid: string }) => {
          if (holder.uuid === "holder-2") throw new Error("boom");
          return [makeCopilot()];
        },
      );

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleRefreshAll();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed to refresh 1 agent");
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("is a no-op when there are no holders", async () => {
      mockCopilotStoreState.externalCopilotHolders = [];

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        await result.current.handleRefreshAll();
      });

      expect(mockFetchAgentsData).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  describe("handleSaveEdit", () => {
    it("fetches agents with url and headers only, then persists", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const freshCopilots = [makeCopilot({ id: "agent-updated" })];
      mockFetchAgentsData.mockResolvedValue(freshCopilots);

      const { result } = renderHook(() => useAgentManagement());

      const editData = {
        uuid: "holder-1",
        url: "https://new-url.example.com",
        headerPairs: [{ key: "Authorization", value: "Bearer token123" }],
      };

      await act(async () => {
        await result.current.handleSaveEdit(editData);
      });

      expect(mockFetchAgentsData).toHaveBeenCalledWith({
        url: "https://new-url.example.com",
        headers: { Authorization: "Bearer token123" },
      });
      expect(mockPutCustomCopilot).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Agent settings updated");
    });

    it("rejects duplicate header keys without calling fetchAgentsData", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const { result } = renderHook(() => useAgentManagement());

      const editData = {
        uuid: "holder-1",
        url: "https://agents.example.com",
        headerPairs: [
          { key: "X-Custom", value: "value1" },
          { key: "X-Custom", value: "value2" },
        ],
      };

      await act(async () => {
        await result.current.handleSaveEdit(editData);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Duplicate header keys found");
      expect(mockFetchAgentsData).not.toHaveBeenCalled();
    });

    it("shows error toast when fetchAgentsData rejects", async () => {
      const holder = makeHolder();
      mockCopilotStoreState.externalCopilotHolders = [holder];

      mockFetchAgentsData.mockRejectedValue(new Error("Connection refused"));

      const { result } = renderHook(() => useAgentManagement());

      const editData = {
        uuid: "holder-1",
        url: "https://agents.example.com",
        headerPairs: [{ key: "Authorization", value: "Bearer xyz" }],
      };

      await act(async () => {
        await result.current.handleSaveEdit(editData);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed to update agent settings", {
        description: "Connection refused",
      });
    });
  });

  describe("confirmDeleteGroup", () => {
    it("deletes holder and resets selectedCopilot when it belongs to the group", async () => {
      const copilot = makeCopilot({ id: "agent-to-delete" });
      const holder = makeHolder({ copilots: [copilot] });
      mockCopilotStoreState.externalCopilotHolders = [holder];
      mockSelectedCopilot = copilot;

      const { result } = renderHook(() => useAgentManagement());

      // Set groupToDelete
      await act(async () => {
        result.current.handleDeleteGroup("holder-1");
      });

      expect(result.current.state.groupToDelete).toBe("holder-1");

      await act(async () => {
        await result.current.confirmDeleteGroup();
      });

      expect(mockRemoveCustomCopilot).toHaveBeenCalledWith("holder-1");
      expect(mockSetExternalCopilotHolders).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith(
        "Agent group deleted successfully",
      );
      expect(mockSetSelectedCopilot).toHaveBeenCalledWith(
        expect.objectContaining({ id: "openbb-copilot" }),
      );
      expect(result.current.state.groupToDelete).toBeNull();
    });

    it("deletes holder without resetting selectedCopilot when it does not belong to the group", async () => {
      const copilot = makeCopilot({ id: "agent-in-holder" });
      const holder = makeHolder({ copilots: [copilot] });
      mockCopilotStoreState.externalCopilotHolders = [holder];
      mockSelectedCopilot = makeCopilot({ id: "different-agent" });

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        result.current.handleDeleteGroup("holder-1");
      });

      await act(async () => {
        await result.current.confirmDeleteGroup();
      });

      expect(mockRemoveCustomCopilot).toHaveBeenCalledWith("holder-1");
      expect(mockToast.success).toHaveBeenCalledWith(
        "Agent group deleted successfully",
      );
      expect(mockSetSelectedCopilot).not.toHaveBeenCalled();
    });
  });

  describe("handleDeleteGroup", () => {
    it("sets groupToDelete in state", async () => {
      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        result.current.handleDeleteGroup("some-uuid");
      });

      expect(result.current.state.groupToDelete).toBe("some-uuid");
    });
  });

  describe("handleEditGroup", () => {
    it("populates editGroup state with holder data and header pairs", async () => {
      const holder = makeHolder({
        headers: { "X-Api-Key": "key123", Authorization: "Bearer abc" },
      });
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        result.current.handleEditGroup("holder-1");
      });

      expect(result.current.state.editGroup).toEqual({
        uuid: "holder-1",
        url: "https://agents.example.com",
        headerPairs: [
          { key: "X-Api-Key", value: "key123" },
          { key: "Authorization", value: "Bearer abc" },
        ],
      });
    });
  });

  describe("filteredGroups", () => {
    it("filters agents by search term matching name or description", async () => {
      const agentAlpha = makeCopilot({
        id: "alpha",
        name: "Alpha Bot",
        description: "Does alpha things",
      });
      const agentBeta = makeCopilot({
        id: "beta",
        name: "Beta Bot",
        description: "Does beta things",
      });
      const holder = makeHolder({ copilots: [agentAlpha, agentBeta] });
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const { result } = renderHook(() => useAgentManagement());

      // Before search, all agents shown
      expect(result.current.filteredGroups).toHaveLength(1);
      expect(result.current.filteredGroups[0].copilots).toHaveLength(2);

      // Search for "alpha" - only agentAlpha should match
      await act(async () => {
        result.current.handleSearchChange("alpha");
      });

      expect(result.current.filteredGroups).toHaveLength(1);
      expect(result.current.filteredGroups[0].copilots).toHaveLength(1);
      expect(result.current.filteredGroups[0].copilots![0].id).toBe("alpha");
    });

    it("includes holders when URL matches search term even if no agents match", async () => {
      const agent = makeCopilot({ id: "agent-1", name: "Bot", description: "A bot" });
      const holder = makeHolder({
        url: "https://special-agents.example.com",
        copilots: [agent],
      });
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        result.current.handleSearchChange("special-agents");
      });

      expect(result.current.filteredGroups).toHaveLength(1);
      expect(result.current.filteredGroups[0].uuid).toBe("holder-1");
    });

    it("excludes holders when neither URL nor agents match", async () => {
      const agent = makeCopilot({ id: "agent-1", name: "Bot", description: "A bot" });
      const holder = makeHolder({ copilots: [agent] });
      mockCopilotStoreState.externalCopilotHolders = [holder];

      const { result } = renderHook(() => useAgentManagement());

      await act(async () => {
        result.current.handleSearchChange("zzz-no-match");
      });

      expect(result.current.filteredGroups).toHaveLength(0);
    });
  });
});
