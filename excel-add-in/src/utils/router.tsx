import { useEffect } from "react";
import {
  ActionFunction,
  createBrowserRouter,
  LoaderFunction,
  useNavigate,
} from "react-router-dom";
import * as backend from "~/backend/auth.api";
import { useAuthStore } from "~/store/auth";
import PageNotFound from "~/taskpane/components/PageNotFound";

if (!history.pushState || !history.replaceState) {
  //- @ts-expect-error - Workaround for Office breaking history
  delete history.pushState;
  //- @ts-expect-error - Workaround for Office breaking history
  delete history.replaceState;
}

interface PageFile {
  default: React.ComponentType;
  loader: () => LoaderFunction;
  action: () => ActionFunction;
  ErrorBoundary: React.ComponentType;
}

const pages = import.meta.glob("~/taskpane/pages/**/*.tsx", { eager: true });
const routes = [];

for (const path of Object.keys(pages)) {
  const fileName = path.match(/\/pages\/(.*)\.tsx$/)?.[1];
  if (!fileName) continue;

  const page = pages[path] as PageFile;
  if (!page) continue;

  const normalizedPathName = fileName.includes("$")
    ? fileName.replace("$", ":")
    : fileName.replace(/\/index/, "").replace(/([a-z])([A-Z])/g, "$1-$2");

  routes.push({
    path: fileName === "index" ? "/" : `/${normalizedPathName.toLowerCase()}`,
    loader: page.loader,
    action: page.action,
    Element: page.default,
    ErrorBoundary: page.ErrorBoundary,
  });
}

// Page not found
routes.push({
  path: "*",
  loader: () => import("~/taskpane/components/PageNotFound"),
  action: () => {},
  Element: PageNotFound,
  ErrorBoundary: null,
});

export const router = createBrowserRouter(
  routes.map(({ Element, ErrorBoundary, ...rest }) => ({
    ...rest,
    element: <Element />,
    ...(ErrorBoundary && { errorElement: <ErrorBoundary /> }),
  })),
);

export function usePrivateRoute() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore.getState();
  const isTokenInStorage = !!user?.access_token;

  useEffect(() => {
    if (!isTokenInStorage) {
      console.info("🚫 User is not logged in, redirecting to login page");
      navigate("/auth/login");
    } else {
      console.info("🔐 User is logged in, checking token validity");
      backend.validateUser()
        .then((data) => {
          if (!data.success) {
            console.info("🚫 Token is invalid, redirecting to login page");
            logout();
            navigate("/auth/login");
          }
        })
        .catch((err) => {
          console.error(
            "🚫 Token validation failed, redirecting to login page",
            err,
          );
          logout();
          navigate("/auth/login");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTokenInStorage]);
}
