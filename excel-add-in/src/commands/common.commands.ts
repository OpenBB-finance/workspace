import { useAuthStore } from "~/store/auth";

export function updateRibbon() {
  const { user } = useAuthStore.getState();
  const isLogged = !!user?.access_token;
  console.info("🎛️ Updating ribbon, token in storage?", isLogged);

  Office?.ribbon?.requestUpdate({
    tabs: [
      {
        id: "OpenBB.Tab",
        groups: [
          {
            id: "Group3",
            controls: [
              {
                // This is the Account button
                // TODO: Change the id to Group3.ButtonAccount
                // Will cause a breaking change, the manifest and this change
                // must be deployed in sync
                id: "Group3.Button1",
                enabled: isLogged,
                
              },     
              {
                id: "Group3.ButtonSignIn",
                enabled: !isLogged,
              },
              {
                id: "Group3.ButtonSignOut",
                enabled: isLogged,
              },              
              {
                id: "Group3.ButtonFeedback",
                enabled: isLogged,
              },
            ],
          },
        ],
      },
    ],
  });
}

export function signOut(event: Office.AddinCommands.Event) {
  const { logout } = useAuthStore.getState();
  logout();
  event.completed();
}

Office.actions.associate("signOut", signOut);
