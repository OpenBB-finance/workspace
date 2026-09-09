import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import YouTubeContent from "~/components/DataConnectors/NewComponents/YouTube/Content";
import { DataConnectorContext } from "~/components/DataConnectors/Providers/DataConnectorContext";

vi.mock("~/api/auth.api", () => ({
  getWidgetMetadata: vi.fn().mockResolvedValue([]),
  postWidgetMetadata: vi.fn().mockResolvedValue({ success: true }),
  patchWidgetMetadata: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useBackendConnectorStore: () => ({
    setWidgetMetadata: vi.fn(),
    getWidgetMetadataById: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: () => ({
    getWidgetsByAttribute: vi.fn().mockReturnValue({}),
    updateWidget: vi.fn(),
  }),
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    capture: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  FormInput: ({ label, placeholder, onChange, value, ...props }: any) => (
    <div>
      <label htmlFor={label}>{label}</label>
      <input
        id={label}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={label}
        {...props}
      />
    </div>
  ),
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  FormSelect: ({ label, options, onChange, value }: any) => (
    <div>
      <label htmlFor={label}>{label}</label>
      <select
        id={label}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={label}
      >
        {options?.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock("~/components/ds/atoms/TextArea", () => ({
  FormTextarea: ({ label, placeholder, onChange, value, ...props }: any) => (
    <div>
      <label htmlFor={label}>{label}</label>
      <textarea
        id={label}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={label}
        {...props}
      />
    </div>
  ),
}));

vi.mock("~/components/ds/molecules/Form", () => ({
  Form: ({ children }: any) => <div data-testid="form">{children}</div>,
  FormField: ({ render, name }: any) =>
    render({ field: { value: "", onChange: vi.fn(), name } }),
}));

vi.mock("~/components/ds/molecules/Tabs", () => ({
  Tabs: ({ children, value, onValueChange }: any) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({ children, value }: any) => (
    <button data-testid={`tab-trigger-${value}`}>{children}</button>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, onClick }: any) => (
    <span data-testid={`icon-${id}`} onClick={onClick}>
      {id}
    </span>
  ),
}));

const mockContextValue = {
  setOpen: vi.fn(),
  dashboardId: "test-dashboard",
  pendingNavigate: vi.fn(),
  mode: "create" as const,
  id: "test-id",
  open: true,
  dcTab: "youtube" as const,
  setDcTab: vi.fn(),
};

const renderWithProvider = (contextOverrides = {}) => {
  return render(
    <DataConnectorContext.Provider
      // @ts-expect-error - ignored for now
      value={{ ...mockContextValue, ...contextOverrides }}
    >
      <YouTubeContent />
    </DataConnectorContext.Provider>,
  );
};

describe("YouTubeContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form with default values in create mode", () => {
    renderWithProvider();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("YouTube URL")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByText("Add")).toBeInTheDocument();
  });

  it("renders form in edit mode with Update button", () => {
    renderWithProvider({ mode: "edit" });

    expect(screen.getByText("Update")).toBeInTheDocument();
  });

  it("renders tabs in create mode", () => {
    renderWithProvider();

    expect(screen.getByTestId("tabs")).toBeInTheDocument();
    expect(screen.getByTestId("tabs-list")).toBeInTheDocument();
  });

  it("does not render tabs in edit mode", () => {
    renderWithProvider({ mode: "edit" });

    expect(screen.queryByTestId("tabs")).not.toBeInTheDocument();
  });

  it("has submit button initially disabled", () => {
    renderWithProvider();

    const submitButton = screen.getByTestId("button");
    expect(submitButton).toBeDisabled();
  });

  it("shows metadata section with optional fields", () => {
    renderWithProvider();

    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });

  it("keeps submit button disabled for invalid YouTube URL", async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const urlInput = screen.getByLabelText("YouTube URL");
    await user.type(urlInput, "https://example.com/not-youtube");

    const submitButton = screen.getByTestId("button");
    expect(submitButton).toBeDisabled();
  });
});
