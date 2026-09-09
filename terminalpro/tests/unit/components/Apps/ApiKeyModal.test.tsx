import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyModal } from "~/components/Apps/ApiKeyModal";
import type { ListedApp, ListedAppAuthValue } from "~/types/listedApps";

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    disabled,
    loading,
    onClick,
    type = "button",
  }: {
    children: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
    type?: "button" | "submit";
  }) => (
    <button type={type} disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: forwardRef<HTMLInputElement, any>(
    ({ label, value, onChange, placeholder }, ref) => (
      <label>
        <span>{label}</span>
        <input
          ref={ref}
          aria-label={label}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </label>
    ),
  ),
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const app: ListedApp = {
  id: "app-1",
  vendorName: "Acme",
  appName: "Acme Data",
  description: "Test app",
  backendUrl: "https://example.com",
  thumbnail: "",
  authType: ["api_key"],
};

describe("ApiKeyModal", () => {
  it("shows add-state copy when no API key exists", () => {
    render(
      <ApiKeyModal
        app={app}
        hasSavedAuth={false}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue({ success: true })}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add API Key" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove API key" }),
    ).not.toBeInTheDocument();
  });

  it("shows update-state copy when an API key exists", () => {
    render(
      <ApiKeyModal
        app={app}
        hasSavedAuth={true}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue({ success: true })}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Configure API Key" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove API key" })).toBeInTheDocument();
  });

  it("renders custom authentication fields when the vendor defines them", () => {
    const customApp: ListedApp = {
      ...app,
      authType: ["custom"],
      authFields: [
        { id: "api_key", label: "API Key", key: "Authorization", prefix: "Bearer " },
        { id: "client_id", label: "Client ID", key: "X-Client-Id" },
      ],
    };

    render(
      <ApiKeyModal
        app={customApp}
        hasSavedAuth={false}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn<(_: ListedAppAuthValue[]) => Promise<{ success: boolean }>>().mockResolvedValue({ success: true })}
        onRemove={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Add Authentication" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Client ID")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove authentication" }),
    ).not.toBeInTheDocument();
  });

  it("renders both an API key and an optional MCP token field", () => {
    render(
      <ApiKeyModal
        app={app}
        hasSavedAuth={false}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue({ success: true })}
        onRemove={vi.fn()}
        mcpToken={{ onSave: vi.fn() }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Add API Keys" })).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP token (optional)")).toBeInTheDocument();
  });

  it("saves only the MCP token for a token-only app", async () => {
    const onSaveToken = vi.fn();
    const onSave = vi.fn().mockResolvedValue({ success: true });
    const onClose = vi.fn();
    const tokenApp: ListedApp = { ...app, authType: ["none"] };

    render(
      <ApiKeyModal
        app={tokenApp}
        hasSavedAuth={false}
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        onRemove={vi.fn()}
        mcpToken={{ onSave: onSaveToken }}
      />,
    );

    // No API key field — the token is the only credential.
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("MCP token"), {
      target: { value: "Bearer tok-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onSaveToken).toHaveBeenCalledWith("tok-123"));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
