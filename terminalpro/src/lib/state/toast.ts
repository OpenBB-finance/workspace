import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotificationId } from "../utils/toast";

interface ToastState {
  toasts: Partial<Record<NotificationId, { dontShowAgain: boolean }>>;
  getToastDontShowAgain: (id: NotificationId) => boolean;
  setToastDontShowAgain: (id: NotificationId, dontShowAgain: boolean) => void;
}

export const useToastStore = create<ToastState>()(
  persist(
    (set, get) => ({
      toasts: {},
      getToastDontShowAgain(id) {
        return get().toasts[id]?.dontShowAgain;
      },
      setToastDontShowAgain(id, dontShowAgain) {
        set((state) => ({
          toasts: {
            ...state.toasts,
            [id]: { ...state.toasts[id], dontShowAgain },
          },
        }));
      },
    }),
    {
      name: "toast-storage",
    },
  ),
);
