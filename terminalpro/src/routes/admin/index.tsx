import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import Icon from "~/components/Icon";
import { useAuthStore } from "~/lib/state/auth";

export default function AdminHome() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      navigate("/admin/users");
    } else {
      navigate("/login");
    }
  }, []);
  return null;
}

export function RenderNoData(props: {
  isError: boolean;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  if (props.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <BrandedLoadingState />
      </div>
    );
  }
  if (props.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-ds-text-caption body-xs-medium">
        <Icon id="exclamation-outline-triangle" className="size-6" />
        <div>Something went wrong</div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-ds-text-caption body-xs-medium">
      <Icon id="info-outline-circle" className="size-6" />
      {props.children && props.children}
    </div>
  );
}
