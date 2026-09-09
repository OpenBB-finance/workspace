import Navigation from "components/navigation";
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { type AuthStore, useAuthStore } from "utils/auth";

export default function ProtectedRoute(): JSX.Element {
  const user = useAuthStore((state: AuthStore) => state.user);
  if (user === null || user === undefined) {
    return <Navigate to="/login" />;
  }
  return (
    <div className="min-h-screen bg-surface-page">
      <Navigation />
      <div className="obb-page-container">
        <Outlet />
      </div>
    </div>
  );
}
