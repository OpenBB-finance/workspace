import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShallowAuthStore } from "~/lib/state/auth";

export default function HomePage() {
  const user = useShallowAuthStore((state) => state.user);
  const navigate = useNavigate();
  useEffect(() => {
    // "/" is a pure redirect: replace it so Back does not land here and bounce
    // forward again, and keep the deps so this fires once per auth change rather
    // than on every render.
    navigate(user ? "/app" : "/login", { replace: true });
  }, [user, navigate]);
  return null;
}
