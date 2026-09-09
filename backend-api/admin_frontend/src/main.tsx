import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { Toaster } from 'sonner';
import ProtectedRoute from "./components/protectedRoute";
import "./index.css";
import AddInstaller from "./routes/addInstaller";
import Docs from "./routes/docs";
import Login from "./routes/login";
import ManageEntities from "./routes/manageEntities";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <ManageEntities /> },
      { path: "/docs", element: <Docs /> },
      { path: "/addInstaller", element: <AddInstaller /> },
      { path: "/manageEntities", element: <ManageEntities /> },
    ],
  },
]);

const preferredTheme = window.localStorage.getItem("theme") ?? "dark";
const normalizedTheme = preferredTheme === "light" ? "light" : "dark";
window.localStorage.setItem("theme", normalizedTheme);
document.documentElement.classList.toggle("dark", normalizedTheme === "dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <Toaster
      position="top-right"
      expand={true}
      richColors
      duration={20000}
      closeButton={true}
      theme={normalizedTheme}
    />
  </React.StrictMode>,
);
