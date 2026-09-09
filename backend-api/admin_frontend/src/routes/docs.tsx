import React from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { type AuthStore, useAuthStore } from "utils/auth";

interface ForSwagger {
  Authorization: string;
}

type SwaggerRequest = Record<string, ForSwagger>;

export default function Docs(): JSX.Element {
  const user = useAuthStore((state: AuthStore) => state.user);
  const token = user === null ? "" : user.accessToken;
  const requestInterceptor = (
    req: SwaggerRequest,
  ): SwaggerRequest | Promise<SwaggerRequest> => ({
    ...req,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const url = `${import.meta.env.VITE_API_URL}/openapi.json`;
  return (
    <div className="obb-card overflow-hidden">
      <div className="obb-card-header">
        <h1 className="obb-admin-title">API Documentation</h1>
      </div>
      <div className="obb-card-content">
        <SwaggerUI url={url} requestInterceptor={requestInterceptor} />
      </div>
    </div>
  );
}
