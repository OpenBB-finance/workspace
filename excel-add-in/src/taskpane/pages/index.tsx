import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Page() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/account");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
