import type { NavigateFunction } from "react-router-dom";
import type { User } from "utils/requests";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthStore {
  user: User | null;
  login: (data: User, navigate: NavigateFunction) => void;
  logout: (navigate: NavigateFunction) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      login: (data, navigate) => {
        set({
          user: {
            uuid: data.uuid,
            accessToken: data.accessToken,
            email: data.email,
          },
        });
        navigate("/", { replace: true });
      },
      logout: (navigate) => {
        set({ user: null });
        navigate("/login", { replace: true });
      },
      user: null,
    }),
    {
      name: "auth-storage",
    },
  ),
);
