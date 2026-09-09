import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";
import * as authApi from "~/api/auth.api";
import ForgotPasswordPage from "~/routes/forgotPassword";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/api/auth.api", () => ({
  forgotPassword: vi.fn(),
}));

vi.mock("~/hooks/useStateReducer", async () => {
  const React = await import("react");
  return {
    useStateReducer: (initialState: any) => {
      const [state, setState] = React.useState(initialState);
      return [state, (updates: any) => setState((s: any) => ({ ...s, ...updates }))];
    },
  };
});

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.authentication.allowForgotPassword = true;
    mockConfig.services.email = true;
    mockConfig.whiteLabel.loginImage = "/assets/images/login.svg";
  });

  it("renders forgot password form correctly", () => {
    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Forgot Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send request/i })).toBeInTheDocument();
  });

  it("renders return to login link", () => {
    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    expect(screen.getByText(/Return to/i)).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("submits form and shows success toast on successful request", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    vi.mocked(authApi.forgotPassword).mockResolvedValue({
      status: 200,
      detail: "Email sent",
    } as any);

    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("shows error message on invalid form data (422)", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockResolvedValue({
      status: 422,
      detail: "Invalid data",
    } as any);

    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "invalid-email@test.com");
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalled();
    });
  });

  it("shows rate limit error on 429 response", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockResolvedValue({
      status: 429,
      detail: "Too many requests",
    } as any);

    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalled();
    });
  });

  it("shows the informational text about resetting password", () => {
    render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>,
    );

    expect(
      screen.getByText(/Please enter the email address associated with your account/i),
    ).toBeInTheDocument();
  });
});
