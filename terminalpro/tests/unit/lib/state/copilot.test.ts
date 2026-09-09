import { beforeEach, describe, expect, it } from "vitest";
import {
  type CreateWidgetMetadataDialogState,
  getReachableArtifacts,
  useCopilotStore,
} from "~/lib/state/copilot";

describe("getReachableArtifacts", () => {
  it("should return empty array when no messages are provided", () => {
    const result = getReachableArtifacts(
      [],
      [{ uuid: "123", type: "text", content: "test" }],
    );
    expect(result).toEqual([]);
  });

  it("should return empty array when no artifacts are provided", () => {
    const messages = [
      {
        role: "ai" as const,
        content: "test message",
        timestamp: 123,
        copilotId: "test",
      },
    ];
    const result = getReachableArtifacts(messages, []);
    expect(result).toEqual([]);
  });

  it("should return empty array when undefined is provided", () => {
    const messages = [
      {
        role: "ai" as const,
        content: "Here is artifact-1 and artifact-2",
        timestamp: 123,
        copilotId: "test",
      },
      {
        role: "human" as const,
        content: "What about artifact-3?",
        timestamp: 124,
        copilotId: "test",
      },
    ];

    const result = getReachableArtifacts(messages, undefined);
    expect(result).toEqual([]);
  });

  it("should return only artifacts referenced in AI messages", () => {
    const artifact1 = {
      uuid: "artifact-1",
      type: "text" as const,
      content: "test content 1",
    };
    const artifact2 = {
      uuid: "artifact-2",
      type: "text" as const,
      content: "test content 2",
    };
    const artifact3 = {
      uuid: "artifact-3",
      type: "text" as const,
      content: "test content 3",
    };

    const messages = [
      {
        role: "ai" as const,
        content: "Here is artifact-1 and artifact-2",
        timestamp: 123,
        copilotId: "test",
      },
      {
        role: "human" as const,
        content: "What about artifact-3?",
        timestamp: 124,
        copilotId: "test",
      },
    ];

    const result = getReachableArtifacts(messages, [artifact1, artifact2, artifact3]);
    expect(result).toEqual([artifact1, artifact2]);
  });

  it("should handle artifacts with names", () => {
    const artifact1 = {
      uuid: "artifact-1",
      name: "Chart 1",
      type: "text" as const,
      content: "chart content",
    };
    const artifact2 = {
      uuid: "artifact-2",
      name: "Table 1",
      type: "text" as const,
      content: "table content",
    };

    const messages = [
      {
        role: "ai" as const,
        content: "Here is Chart 1 for you",
        timestamp: 123,
        copilotId: "test",
      },
    ];

    const result = getReachableArtifacts(messages, [artifact1, artifact2]);
    expect(result).toEqual([artifact1]);
  });

  it("should handle null or undefined values gracefully", () => {
    const messages = [
      { role: "ai" as const, content: null, timestamp: 123, copilotId: "test" },
      { role: "ai" as const, content: "artifact-1", timestamp: 124, copilotId: "test" },
    ];

    const artifacts = [
      { uuid: "artifact-1", type: "text", content: "test" },
      { uuid: null, type: "text", content: "test" },
      undefined,
    ];

    // @ts-ignore - Intentionally testing with invalid data
    const result = getReachableArtifacts(messages, artifacts);
    expect(result).toHaveLength(1);
    expect(result[0].uuid).toBe("artifact-1");
  });
});

describe("createWidgetMetadataDialog state", () => {
  beforeEach(() => {
    // Reset dialog state before each test
    useCopilotStore.setState({ createWidgetMetadataDialog: null });
  });

  it("should have null as initial dialog state", () => {
    const state = useCopilotStore.getState();
    expect(state.createWidgetMetadataDialog).toBeNull();
  });

  it("should set dialog state for create mode", () => {
    const dialogState: CreateWidgetMetadataDialogState = {
      mode: "create",
      initialValues: {
        name: "Test Widget",
        description: "Test Description",
      },
      pendingParams: {
        widgetType: "table",
        content: [{ col1: "data" }],
      },
    };

    useCopilotStore.getState().setCreateWidgetMetadataDialog(dialogState);

    const state = useCopilotStore.getState();
    expect(state.createWidgetMetadataDialog).toEqual(dialogState);
    expect(state.createWidgetMetadataDialog?.mode).toBe("create");
    expect(state.createWidgetMetadataDialog?.initialValues.name).toBe("Test Widget");
  });

  it("should set dialog state for update mode", () => {
    const dialogState: CreateWidgetMetadataDialogState = {
      mode: "update",
      initialValues: {
        name: "Existing Widget",
        description: "Existing Description",
        category: "Economy",
      },
      widgetId: "copilot_table-uuid-123",
      widgetUuid: "uuid-123",
      dashboardId: "dashboard-456",
    };

    useCopilotStore.getState().setCreateWidgetMetadataDialog(dialogState);

    const state = useCopilotStore.getState();
    expect(state.createWidgetMetadataDialog).toEqual(dialogState);
    expect(state.createWidgetMetadataDialog?.mode).toBe("update");
    expect(state.createWidgetMetadataDialog?.widgetId).toBe("copilot_table-uuid-123");
  });

  it("should close dialog by setting state to null", () => {
    // First open the dialog
    useCopilotStore.getState().setCreateWidgetMetadataDialog({
      mode: "create",
      initialValues: { name: "Test" },
      pendingParams: {},
    });

    expect(useCopilotStore.getState().createWidgetMetadataDialog).not.toBeNull();

    // Close the dialog
    useCopilotStore.getState().closeCreateWidgetMetadataDialog();

    expect(useCopilotStore.getState().createWidgetMetadataDialog).toBeNull();
  });

  it("should allow updating dialog state", () => {
    // Set initial state
    useCopilotStore.getState().setCreateWidgetMetadataDialog({
      mode: "create",
      initialValues: { name: "Initial" },
      pendingParams: {},
    });

    // Update to different state
    useCopilotStore.getState().setCreateWidgetMetadataDialog({
      mode: "update",
      initialValues: { name: "Updated" },
      widgetId: "widget-123",
      widgetUuid: "uuid-123",
    });

    const state = useCopilotStore.getState();
    expect(state.createWidgetMetadataDialog?.mode).toBe("update");
    expect(state.createWidgetMetadataDialog?.initialValues.name).toBe("Updated");
  });

  it("should handle all optional metadata fields", () => {
    const dialogState: CreateWidgetMetadataDialogState = {
      mode: "create",
      initialValues: {
        name: "Full Widget",
        description: "Full Description",
        category: "Stocks",
        subCategory: "US Markets",
        source: "OpenBB",
      },
      pendingParams: {},
    };

    useCopilotStore.getState().setCreateWidgetMetadataDialog(dialogState);

    const state = useCopilotStore.getState();
    expect(state.createWidgetMetadataDialog?.initialValues).toEqual({
      name: "Full Widget",
      description: "Full Description",
      category: "Stocks",
      subCategory: "US Markets",
      source: "OpenBB",
    });
  });
});
