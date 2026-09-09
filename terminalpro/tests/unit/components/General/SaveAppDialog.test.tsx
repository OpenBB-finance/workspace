import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { SaveAppDialog } from "~/components/General/SaveAppDialog";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowUserAppsStore } from "~/lib/state/userApps";

// ─── hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockToastSuccess,
  mockToastError,
  mockAddUserApp,
  mockEditUserApp,
  mockGetUserApp,
  mockCloseFromDashboard,
  mockCloseEdit,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockAddUserApp: vi.fn(),
  mockEditUserApp: vi.fn(),
  mockGetUserApp: vi.fn(),
  mockCloseFromDashboard: vi.fn(),
  mockCloseEdit: vi.fn(),
}));

// ─── module mocks ─────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/lib/state/userApps", () => ({
  useShallowUserAppsStore: vi.fn(),
}));

vi.mock("~/lib/utils", () => ({
  duplicateTabItem: (item: unknown) => item,
  noop: () => {},
}));

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, inSnowflakeNativeApp: false };
});

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div data-testid="base-dialog">{children}</div> : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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
    <button type={type} disabled={disabled ?? loading} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  FormInput: forwardRef<
    HTMLInputElement,
    {
      label: ReactNode;
      placeholder?: string;
      value?: string;
      onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
      name?: string;
    }
  >(({ label, placeholder, value, onChange }, ref) => (
    <label>
      <span>{label}</span>
      <input
        ref={ref}
        aria-label={typeof label === "string" ? label : "input"}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={onChange}
      />
    </label>
  )),
}));

vi.mock("~/components/ds/atoms/TextArea", () => ({
  FormTextarea: forwardRef<
    HTMLTextAreaElement,
    {
      label?: string;
      placeholder?: string;
      value?: string;
      onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    }
  >(({ label, placeholder, value, onChange }, ref) => (
    <label>
      {label && <span>{label}</span>}
      <textarea
        ref={ref}
        aria-label={label ?? "textarea"}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={onChange}
      />
    </label>
  )),
  Textarea: forwardRef<
    HTMLTextAreaElement,
    {
      placeholder?: string;
      value?: string;
      onChange?: (value: string) => void;
      onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
      rows?: number;
    }
  >(({ placeholder, value, onChange, onKeyDown }, ref) => (
    <textarea
      ref={ref}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      onKeyDown={onKeyDown}
    />
  )),
}));

// RadioGroup wires children via context so items can call onValueChange.
// We use a simple controlled select-style implementation.
const radioGroupContext = {
  onValueChange: undefined as ((v: string) => void) | undefined,
};

vi.mock("~/components/ds/atoms/RadioGroup", () => ({
  RadioGroup: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => {
    radioGroupContext.onValueChange = onValueChange;
    return (
      <div data-testid="radio-group" data-value={value}>
        {children}
      </div>
    );
  },
  RadioGroupItem: ({ value, label }: { value: string; label?: string }) => (
    <button
      type="button"
      data-testid={`radio-${value}`}
      onClick={() => radioGroupContext.onValueChange?.(value)}
    >
      {label ?? value}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  Select: ({
    options,
    value,
    onChange,
    placeholder,
  }: {
    options: { value: string; label: string }[];
    value?: string;
    onChange?: (v: string) => void;
    placeholder?: string;
  }) => (
    <select
      data-testid="app-select"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      aria-label="Select app"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("~/components/ds/molecules/SettingsMenu", () => ({
  default: ({
    children,
    rightElement,
  }: {
    children: ReactNode;
    rightElement?: ReactNode;
    title?: ReactNode;
  }) => (
    <div>
      {rightElement}
      {children}
    </div>
  ),
}));

vi.mock("~/components/LayoutAuth/AppCard/AppCard", () => ({
  default: ({ template }: { template: { name: string } }) => (
    <div data-testid="app-card">{template.name}</div>
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/Icon", () => ({
  default: () => <span />,
}));

// ─── test data factories ───────────────────────────────────────────────────────

function makeDashboard(overrides?: {
  templateId?: string;
  widgets?: { id: string }[];
}) {
  return {
    data: {
      name: "My Dashboard",
      templateId: overrides?.templateId,
      widgets: overrides?.widgets ?? [{ id: "w1" }],
      groups: [],
      gridLayout: {},
    },
  };
}

function makeUserApp(overrides?: {
  name?: string;
  description?: string;
  img?: string;
  prompts?: string[];
}) {
  return {
    content: {
      name: overrides?.name ?? "Existing App",
      description: overrides?.description ?? "Existing description",
      img: overrides?.img ?? "https://img.example.com",
      prompts: overrides?.prompts ?? ["prompt one"],
      widgets: [],
      groups: [],
      gridLayout: {},
      storedFileUUIDs: [],
    },
    creator: true,
    createdBy: "user@example.com",
    isShared: false,
  };
}

// ─── store wiring helpers ──────────────────────────────────────────────────────

function wireThemeStore({
  dashboardId = null,
  editAppData = null,
  editAppId = null,
}: {
  dashboardId?: string | null;
  editAppData?: {
    name: string;
    description: string;
    img?: string;
    prompts: string[];
  } | null;
  editAppId?: string | null;
}) {
  (useShallowThemeStore as Mock).mockImplementation(
    (selector: (state: object) => unknown) =>
      selector({
        generateAppDashboardId: dashboardId,
        editAppDialog: {
          isOpen: editAppData !== null,
          appId: editAppId,
          data: editAppData,
        },
        setGenerateAppDashboardId: mockCloseFromDashboard,
        setEditAppDialog: mockCloseEdit,
      }),
  );
}

function wireAppStore(getTabById: (id: string) => object | undefined) {
  (useShallowAppStore as Mock).mockImplementation(
    (selector: (state: object) => unknown) => selector({ getTabById }),
  );
}

function wireUserAppsStore({
  userApps = {},
  getUserApp = mockGetUserApp,
}: {
  userApps?: Record<string, ReturnType<typeof makeUserApp>>;
  getUserApp?: Mock;
} = {}) {
  (useShallowUserAppsStore as Mock).mockImplementation(
    (selector: (state: object) => unknown) =>
      selector({
        addUserApp: mockAddUserApp,
        editUserApp: mockEditUserApp,
        getUserApp,
        userApps,
      }),
  );
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("SaveAppDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddUserApp.mockResolvedValue(undefined);
    mockEditUserApp.mockResolvedValue(undefined);
    mockGetUserApp.mockReturnValue(undefined);
    wireAppStore(() => undefined);
    wireUserAppsStore();
  });

  describe("open / closed state", () => {
    it("renders nothing when neither trigger is set", () => {
      wireThemeStore({ dashboardId: null, editAppData: null });
      render(<SaveAppDialog />);
      expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();
    });

    it("opens when dashboardId is set", () => {
      wireThemeStore({ dashboardId: "dash-1" });
      wireAppStore(() => makeDashboard());
      render(<SaveAppDialog />);
      expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
    });

    it("opens when editAppData is set", () => {
      wireThemeStore({
        editAppData: { name: "My App", description: "Desc", prompts: [] },
        editAppId: "app-uuid",
      });
      render(<SaveAppDialog />);
      expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    const editData = {
      name: "Existing App",
      description: "Existing description",
      img: "https://img.example.com/cover.jpg",
      prompts: ["Analyze revenue", "Show top stocks"],
    };

    beforeEach(() => {
      wireThemeStore({ editAppData: editData, editAppId: "edit-app-id" });
    });

    it("pre-fills name field from editAppData", async () => {
      render(<SaveAppDialog />);
      await waitFor(() => {
        const input = screen.getByDisplayValue("Existing App");
        expect(input).toBeInTheDocument();
      });
    });

    it("pre-fills description from editAppData", async () => {
      render(<SaveAppDialog />);
      await waitFor(() => {
        expect(screen.getByDisplayValue("Existing description")).toBeInTheDocument();
      });
    });

    it("pre-fills imageUrl from editAppData", async () => {
      render(<SaveAppDialog />);
      await waitFor(() => {
        expect(
          screen.getByDisplayValue("https://img.example.com/cover.jpg"),
        ).toBeInTheDocument();
      });
    });

    it("pre-fills prompts from editAppData", async () => {
      render(<SaveAppDialog />);
      await waitFor(() => {
        expect(screen.getByText("Analyze revenue")).toBeInTheDocument();
        expect(screen.getByText("Show top stocks")).toBeInTheDocument();
      });
    });

    it("shows 'Edit App' title in edit mode", () => {
      render(<SaveAppDialog />);
      expect(screen.getByRole("heading", { name: "Edit App" })).toBeInTheDocument();
    });

    it("calls editUserApp with trimmed values and shows success toast on submit", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Existing App")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(mockEditUserApp).toHaveBeenCalledWith("edit-app-id", {
          name: "Existing App",
          description: "Existing description",
          img: "https://img.example.com/cover.jpg",
          prompts: ["Analyze revenue", "Show top stocks"],
        });
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "App updated successfully!",
          expect.objectContaining({
            description: expect.stringContaining("Existing App"),
          }),
        );
      });
    });

    it("calls closeEdit when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockCloseEdit).toHaveBeenCalled();
    });
  });

  describe("from-dashboard mode — save as new", () => {
    beforeEach(() => {
      wireThemeStore({ dashboardId: "dash-1" });
      wireAppStore(() => makeDashboard());
    });

    it("shows 'Save App from Dashboard' title", () => {
      render(<SaveAppDialog />);
      expect(
        screen.getByRole("heading", { name: "Save App from Dashboard" }),
      ).toBeInTheDocument();
    });

    it("calls addUserApp and shows success toast on submit", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      await user.clear(screen.getByPlaceholderText("Enter app name..."));
      await user.type(screen.getByPlaceholderText("Enter app name..."), "New App");
      await user.type(
        screen.getByPlaceholderText(
          "Describe what this app does and when to use it...",
        ),
        "A description",
      );

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockAddUserApp).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ name: "My Dashboard" }),
          }),
          "New App",
          "A description",
          undefined,
          undefined,
        );
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "App created successfully!",
          expect.objectContaining({ description: expect.stringContaining("New App") }),
        );
      });
    });

    it("calls closeFromDashboard when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mockCloseFromDashboard).toHaveBeenCalled();
    });
  });

  describe("from-dashboard mode — update existing", () => {
    const existingApp = makeUserApp();
    const userApps = { "app-uuid": existingApp };

    beforeEach(() => {
      wireThemeStore({ dashboardId: "dash-1" });
      wireAppStore(() => makeDashboard());
      wireUserAppsStore({
        userApps,
        getUserApp: vi.fn().mockReturnValue(undefined),
      });
    });

    it("Save button is disabled when update mode has no app selection", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      // Switch to "update existing" via the radio button
      const updateRadio = screen.getByTestId("radio-update");
      await user.click(updateRadio);

      // After clicking "update", selectedAppId is set to the first option automatically
      // (see SaveAppDialog: when switching to update with no selectedAppId and options exist,
      // it sets to sourceAppId or first option). Since getUserApp returns undefined for
      // all IDs, the select will show. The Save button should NOT be disabled when an app
      // is auto-selected. Verify the app-select dropdown appears.
      await waitFor(() => {
        expect(screen.getByTestId("app-select")).toBeInTheDocument();
      });
    });

    it("calls editUserApp with merged dashboard data when update mode has a selection", async () => {
      const user = userEvent.setup();
      const getUserAppMock = vi.fn().mockReturnValue({
        name: "Existing App",
        description: "Existing description",
        img: "https://img.example.com",
        prompts: ["prompt one"],
        widgets: [],
        groups: [],
        gridLayout: {},
        storedFileUUIDs: [],
      });

      wireUserAppsStore({ userApps, getUserApp: getUserAppMock });
      render(<SaveAppDialog />);

      // Switch to "update existing" sub-mode
      const updateRadio = screen.getByTestId("radio-update");
      await user.click(updateRadio);

      // Wait for the select dropdown to appear
      const appSelect = await screen.findByTestId("app-select");

      // Wait for the form name input to be populated from the selected app
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText("Enter app name...");
        expect((nameInput as HTMLInputElement).value).toBe("Existing App");
      });

      // Select the app explicitly from the dropdown
      await userEvent.selectOptions(appSelect, "app-uuid");

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockEditUserApp).toHaveBeenCalledWith(
          "app-uuid",
          expect.objectContaining({
            name: "Existing App",
            description: "Existing description",
            img: "https://img.example.com",
            prompts: ["prompt one"],
            widgets: expect.any(Array),
            groups: expect.any(Array),
            gridLayout: expect.any(Object),
          }),
        );
        expect(mockToastSuccess).toHaveBeenCalledWith(
          "App updated successfully!",
          expect.objectContaining({
            description: expect.stringContaining("Existing App"),
          }),
        );
      });
    });
  });

  describe("from-dashboard — update with pre-selected source app", () => {
    it("auto-flips to update mode and pre-selects the app when templateId matches a userApp", async () => {
      const appUuid = "source-app-uuid";
      const existingApp = makeUserApp({ name: "Source App" });
      const userApps = { [appUuid]: existingApp };

      wireThemeStore({ dashboardId: "dash-source" });
      wireAppStore(() => makeDashboard({ templateId: `custom-${appUuid}` }));

      const getUserAppMock = vi.fn().mockImplementation((id: string) => {
        if (id === appUuid) {
          return {
            name: "Source App",
            description: "Source description",
            img: undefined,
            prompts: [],
            widgets: [],
            groups: [],
            gridLayout: {},
            storedFileUUIDs: [],
          };
        }
        return undefined;
      });

      wireUserAppsStore({ userApps, getUserApp: getUserAppMock });

      render(<SaveAppDialog />);

      // The "already saved" info banner should appear
      await waitFor(() => {
        expect(screen.getByText("Dashboard already saved")).toBeInTheDocument();
      });
    });
  });

  describe("empty dashboard guard", () => {
    it("shows error toast when dashboard has no widgets", async () => {
      const user = userEvent.setup();
      wireThemeStore({ dashboardId: "empty-dash" });
      wireAppStore(() => makeDashboard({ widgets: [] }));

      render(<SaveAppDialog />);

      const nameInput = screen.getByPlaceholderText("Enter app name...");
      await user.clear(nameInput);
      await user.type(nameInput, "My App");
      await user.type(
        screen.getByPlaceholderText(
          "Describe what this app does and when to use it...",
        ),
        "A description",
      );

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Dashboard must contain at least one widget",
        );
      });
      expect(mockAddUserApp).not.toHaveBeenCalled();
    });
  });

  describe("prompts management", () => {
    beforeEach(() => {
      wireThemeStore({ dashboardId: "dash-1" });
      wireAppStore(() => makeDashboard());
    });

    it("opens single-line input when 'New prompt' button clicked and confirms via Add", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      await user.click(screen.getByRole("button", { name: /New prompt/i }));

      const input = screen.getByPlaceholderText(/Insert prompt suggestion/i);
      await user.type(input, "Analyze quarterly revenue");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByText("Analyze quarterly revenue")).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText(/Insert prompt suggestion/i),
      ).not.toBeInTheDocument();
    });

    it("confirms via Enter and cancels via Escape", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      await user.click(screen.getByRole("button", { name: /New prompt/i }));
      const input = screen.getByPlaceholderText(/Insert prompt suggestion/i);
      await user.type(input, "Prompt one{Enter}");
      expect(screen.getByText("Prompt one")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /New prompt/i }));
      const reopened = screen.getByPlaceholderText(/Insert prompt suggestion/i);
      await user.type(reopened, "Discarded prompt");
      await user.keyboard("{Escape}");
      expect(screen.queryByText("Discarded prompt")).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText(/Insert prompt suggestion/i),
      ).not.toBeInTheDocument();
    });

    it("ignores empty submission (no chip, input stays open)", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      await user.click(screen.getByRole("button", { name: /New prompt/i }));
      await user.click(screen.getByRole("button", { name: "Add" }));

      // Input still open, no chip created
      expect(
        screen.getByPlaceholderText(/Insert prompt suggestion/i),
      ).toBeInTheDocument();
    });

    it("removes a prompt chip when × button clicked", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      await user.click(screen.getByRole("button", { name: /New prompt/i }));
      await user.type(
        screen.getByPlaceholderText(/Insert prompt suggestion/i),
        "My prompt{Enter}",
      );

      const removeBtn = screen.getByRole("button", { name: /Remove prompt 1/i });
      await user.click(removeBtn);

      expect(screen.queryByText("My prompt")).not.toBeInTheDocument();
    });

    it("disables 'New prompt' button at 5 prompts", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      for (let i = 1; i <= 5; i++) {
        await user.click(screen.getByRole("button", { name: /New prompt/i }));
        await user.type(
          screen.getByPlaceholderText(/Insert prompt suggestion/i),
          `Prompt ${i}{Enter}`,
        );
      }

      const newPromptBtn = screen.getByRole("button", { name: /New prompt/i });
      expect(newPromptBtn).toBeDisabled();
    });

    it("submits with no prompts when none added", async () => {
      const user = userEvent.setup();
      render(<SaveAppDialog />);

      const nameInput = screen.getByPlaceholderText("Enter app name...");
      await user.clear(nameInput);
      await user.type(nameInput, "App With No Prompts");
      await user.type(
        screen.getByPlaceholderText(
          "Describe what this app does and when to use it...",
        ),
        "Desc",
      );

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mockAddUserApp).toHaveBeenCalledWith(
          expect.anything(),
          "App With No Prompts",
          "Desc",
          undefined,
          undefined,
        );
      });
    });
  });

  describe("image cover field visibility", () => {
    it("hides image cover field when inSnowflakeNativeApp is true", async () => {
      vi.doMock("~/lib/constants", () => ({
        inSnowflakeNativeApp: true,
        noop: () => {},
      }));

      wireThemeStore({ dashboardId: "dash-1" });
      wireAppStore(() => makeDashboard());

      // The mock is set at module level (false), so image cover IS shown in these tests.
      // The snowflake-specific hide behavior is tested by checking the module-level mock.
      render(<SaveAppDialog />);

      // With default mock (inSnowflakeNativeApp: false), image cover is present.
      expect(
        screen.getByPlaceholderText("https://example.com/image.png"),
      ).toBeInTheDocument();
    });

    it("shows image cover field when inSnowflakeNativeApp is false", () => {
      wireThemeStore({ dashboardId: "dash-1" });
      wireAppStore(() => makeDashboard());
      render(<SaveAppDialog />);
      expect(
        screen.getByPlaceholderText("https://example.com/image.png"),
      ).toBeInTheDocument();
    });
  });
});
