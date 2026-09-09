import isEqual from "lodash.isequal";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import type { Selector } from "./app";

export type WorkspaceBridgeStatus =
  | "disabled"
  | "attempting"
  | "connected"
  | "reconnecting";

interface WorkspaceBridgeState {
  isEnabled: boolean;
  status: WorkspaceBridgeStatus;
  lastError: string | null;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  connect: () => void;
  disconnect: () => void;
  updateStatus: (status: WorkspaceBridgeStatus | "failed", message?: string) => void;
}

export const useWorkspaceBridgeStore = createWithEqualityFn<WorkspaceBridgeState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        isEnabled: false,
        status: "disabled",
        lastError: null,
        isModalOpen: false,
        setModalOpen: (open) => set({ isModalOpen: open }),
        connect: () => get().updateStatus("attempting"),
        disconnect: () => get().updateStatus("disabled"),
        updateStatus: (status, message) => {
          set({
            isEnabled: status !== "disabled" && status !== "failed",
            status: status === "failed" ? "disabled" : status,
            lastError: message ?? null,
          });
        },
      }),
      {
        name: "workspace-bridge-store",
        // Hydration is synchronous at store creation, so mutating the drafted
        // state in place here is safe — no subscriber exists yet.
        onRehydrateStorage: () => (state) => {
          // state is undefined when hydration fails (e.g. corrupt storage).
          if (!state) return;
          state.isModalOpen = false;
          state.lastError = null;
          if (state.status === "connected") {
            state.status = "reconnecting";
          }
        },
      },
    ),
  ),
  shallow,
);

export function useShallowWorkspaceBridgeStore<T>(
  selector: Selector<WorkspaceBridgeState, T>,
): T {
  return useWorkspaceBridgeStore(useShallow(selector), (previous, next) =>
    isEqual(previous, next),
  );
}
