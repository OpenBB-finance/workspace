import { useEffect, useRef } from "react";
import { useAuthStore } from "~/lib/state/auth";

export default function useBannerListener() {
  const { user } = useAuthStore();
  const userRef = useRef(user);

  // Update the ref whenever the user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    setTimeout(() => {
      const tryCopilotButtons = document.getElementsByClassName("try_copilot_btn");
      for (const button of tryCopilotButtons) {
        button.addEventListener("click", () => {
          /*if (userRef.current) setCopilotPopup(true);
          else {
            alert("You need to be logged in to use this feature");
            setCopilotPopup(true);
          }*/
        });
      }
    }, 1000);
  }, [user]);
}
