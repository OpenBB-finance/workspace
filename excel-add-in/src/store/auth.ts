import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OPENBB_SANDBOX_BACKEND } from "~/backend";
import { updateRibbon } from "~/commands/common.commands";

import { Backend, User, UserProfile } from "~/types/user.types";

export interface AuthStore {
  user: User | null;
  login: (
    uuid: string,
    email: string,
    username: string,
    access_token: string,
    expiration_date: string,
    profile: UserProfile | undefined,
  ) => void;
  logout: () => void;
  update: (user: Partial<User>) => void;
  getBackends: () => Backend[];
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      login(uuid, email, username, access_token, expiration_date, profile) {
        set({
          user: {
            uuid,
            email,
            username,
            access_token,
            expiration_date,
            profile,
          },
        });
      },
      logout() {
        set({ user: null });
        console.log("🔒 User logged out.");
      },
      update(user) {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              ...user,
            },
          };
        });
      },
      getBackends() {
        const user = get().user;
        const apiSources = user?.profile?.api_sources || [];
        const customBackends = [OPENBB_SANDBOX_BACKEND, ...apiSources];
        return customBackends;
      }
    }),
    {
      name: "auth",
    },
  ),
);

Office.onReady(async () => {
  updateRibbon();

  useAuthStore.subscribe((state, prevState) => {
    if (state.user?.access_token !== prevState.user?.access_token) {
      updateRibbon();
    }
  });
});
