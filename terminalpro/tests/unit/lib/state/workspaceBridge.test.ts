import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceBridgeStore } from "~/lib/state/workspaceBridge";

const STORAGE_KEY = "workspace-bridge-store";

function seedStorage(state: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 0 }));
}

describe("useWorkspaceBridgeStore", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useWorkspaceBridgeStore.setState({
      isEnabled: false,
      status: "disabled",
      lastError: null,
      isModalOpen: false,
    });
  });

  describe("updateStatus", () => {
    it("enables the bridge when connecting", () => {
      useWorkspaceBridgeStore.getState().connect();

      expect(useWorkspaceBridgeStore.getState().status).toBe("attempting");
      expect(useWorkspaceBridgeStore.getState().isEnabled).toBe(true);
      expect(useWorkspaceBridgeStore.getState().lastError).toBeNull();
    });

    it("maps failed to a disabled bridge and keeps the error message", () => {
      useWorkspaceBridgeStore.getState().connect();
      useWorkspaceBridgeStore.getState().updateStatus("failed", "boom");

      expect(useWorkspaceBridgeStore.getState().status).toBe("disabled");
      expect(useWorkspaceBridgeStore.getState().isEnabled).toBe(false);
      expect(useWorkspaceBridgeStore.getState().lastError).toBe("boom");
    });

    it("clears the previous error when a new status has no message", () => {
      useWorkspaceBridgeStore.getState().updateStatus("failed", "boom");
      useWorkspaceBridgeStore.getState().updateStatus("connected");

      expect(useWorkspaceBridgeStore.getState().status).toBe("connected");
      expect(useWorkspaceBridgeStore.getState().lastError).toBeNull();
    });
  });

  describe("rehydration", () => {
    it("resumes a persisted connected session as reconnecting", async () => {
      seedStorage({
        isEnabled: true,
        status: "connected",
        lastError: "stale error",
        isModalOpen: true,
      });

      await useWorkspaceBridgeStore.persist.rehydrate();

      expect(useWorkspaceBridgeStore.getState().status).toBe("reconnecting");
      expect(useWorkspaceBridgeStore.getState().isModalOpen).toBe(false);
      expect(useWorkspaceBridgeStore.getState().lastError).toBeNull();
    });

    it("keeps non-connected persisted statuses as-is", async () => {
      seedStorage({
        isEnabled: true,
        status: "attempting",
        lastError: null,
        isModalOpen: false,
      });

      await useWorkspaceBridgeStore.persist.rehydrate();

      expect(useWorkspaceBridgeStore.getState().status).toBe("attempting");
    });

    it("survives corrupt persisted storage without throwing", async () => {
      localStorage.setItem(STORAGE_KEY, "{not valid json");

      await expect(useWorkspaceBridgeStore.persist.rehydrate()).resolves.not.toThrow();

      // The store stays usable after the failed hydration.
      useWorkspaceBridgeStore.getState().connect();
      expect(useWorkspaceBridgeStore.getState().status).toBe("attempting");
    });
  });
});
