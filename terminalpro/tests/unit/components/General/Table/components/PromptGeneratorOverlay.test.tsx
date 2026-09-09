import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptGeneratorOverlay } from "~/components/General/Table/components/PromptGeneratorOverlay";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";

// Mock the useCodeGeneration hook
const mockMutate = vi.fn();
vi.mock("~/components/General/Table/hooks/useCodeGeneration", () => ({
  useCodeGeneration: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const defaultApiSource = {
  id: "test-source",
  schemas: {
    public: {
      tableName: "users",
      database: "test_db",
      schema: "public",
      columns: [
        { name: "id", type: "integer" },
        { name: "name", type: "varchar" },
        { name: "active", type: "boolean" },
      ],
    },
  },
  semanticViews: {
    "test_db.public.USERS_VIEW": {
      fqn: "test_db.public.USERS_VIEW",
      database: "test_db",
      schema: "public",
      viewName: "USERS_VIEW",
      baseTable: "users",
      comment: "Users semantic view",
    },
  },
};

const mockGetApiSourceById = vi.fn().mockReturnValue(defaultApiSource);

vi.mock("~/lib/state/backendConnector", async () => {
  const actual = await vi.importActual("~/lib/state/backendConnector");
  return {
    ...actual,
    useShallowBackendConnectorStore: vi.fn((selector) =>
      selector({
        getApiSourceById: mockGetApiSourceById,
      }),
    ),
  };
});

const mockUpdateWidget = vi.fn();

const createMockWidgetContext = (widget: Partial<WidgetT> = {}) => ({
  widget: widget as WidgetT,
  widgetFromJSON: undefined,
  updateWidget: mockUpdateWidget,
  widgetRef: { current: widget as WidgetT },
  activeDashboardId: "test-dashboard",
  isShared: false,
  uuid: "test-uuid",
  getWidget: () => widget as WidgetT,
});

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(() => createMockWidgetContext()),
}));

const useWidgetContextMock = vi.mocked(useWidgetContext);

// Mock the theme store
vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: () => "dark",
}));

describe("PromptGeneratorOverlay", () => {
  const defaultProps = {
    language: "sql" as const,
    visible: true,
    onClose: vi.fn(),
    onCodeGenerated: vi.fn(),
  };
  const defaultWidget = {
    id: "test-widget-123",
    widgetId: "test-widget-123",
    storage: {
      params: {
        query: "SELECT * FROM users",
      },
    },
    schemaName: "public",
    sourceId: "test-source",
  } as Partial<WidgetT>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiSourceById.mockReturnValue(defaultApiSource);
    useWidgetContextMock.mockReturnValue(createMockWidgetContext(defaultWidget));
  });

  describe("Input Mode", () => {
    it("renders the prompt input when visible", () => {
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });

    it("does not render when not visible", () => {
      const { container } = render(
        <PromptGeneratorOverlay {...defaultProps} visible={false} />,
      );

      // Component returns null when not visible
      expect(container.firstChild).toBeNull();
    });

    it("shows correct placeholder for SQL", () => {
      render(<PromptGeneratorOverlay {...defaultProps} language="sql" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("placeholder", expect.stringContaining("query"));
    });

    it("shows correct placeholder for Python", () => {
      render(<PromptGeneratorOverlay {...defaultProps} language="python" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute("placeholder", expect.stringContaining("code"));
    });

    it("updates input value when typing", async () => {
      const user = userEvent.setup();
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get all active users");

      expect(textarea).toHaveValue("get all active users");
    });

    it("shows clear button when there is text", async () => {
      const user = userEvent.setup();
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "some prompt");

      // Clear button uses cross-icon
      const clearIcon = screen.getByTestId("icon-cross-icon");
      expect(clearIcon.closest("button")).toBeInTheDocument();
    });

    it("clears input when clear button is clicked", async () => {
      const user = userEvent.setup();
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "some prompt");

      // Clear button uses cross-icon
      const clearIcon = screen.getByTestId("icon-cross-icon");
      await user.click(clearIcon.closest("button")!);

      expect(textarea).toHaveValue("");
    });

    it("disables send button when input is empty", () => {
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons.find(
        (btn) => btn.querySelector('[class*="send"]') || btn.textContent === "",
      );

      expect(sendButton).toBeDisabled();
    });
  });

  describe("Generate Code", () => {
    it("calls generateCode when send button is clicked", async () => {
      const user = userEvent.setup();
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get all users");

      // Find the send button (last button that's not the clear button)
      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          widget_uuid: "test-widget-123",
          language: "sql",
        }),
        expect.any(Object),
      );
    });

    it("preserves text language for omni prompt widgets", async () => {
      const user = userEvent.setup();
      useWidgetContextMock.mockReturnValue(
        createMockWidgetContext({
          id: "text-widget-123",
          widgetId: "text-widget-123",
          storage: {
            params: {
              prompt: "Hello World",
            },
          },
          schemaName: "public",
          sourceId: "test-source",
        } as Partial<WidgetT>),
      );

      render(<PromptGeneratorOverlay {...defaultProps} language="text" />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "update to bye");

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          widget_uuid: "text-widget-123",
          language: "text",
          current_code: "Hello World",
          sql_schema: null,
          semantic_models: null,
          user_prompt: expect.stringContaining("Current text content"),
        }),
        expect.any(Object),
      );
    });

    it("includes semantic models context for Cortex Analyst", async () => {
      const user = userEvent.setup();
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get all users");

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          semantic_models: [{ semantic_view: "test_db.public.USERS_VIEW" }],
        }),
        expect.any(Object),
      );
    });

    it("sends multiple semantic views as semantic models", async () => {
      const user = userEvent.setup();
      mockGetApiSourceById.mockReturnValue({
        ...defaultApiSource,
        semanticViews: {
          "test_db.public.USERS_VIEW":
            defaultApiSource.semanticViews["test_db.public.USERS_VIEW"],
          "test_db.public.ACTIVE_USERS_VIEW": {
            fqn: "test_db.public.ACTIVE_USERS_VIEW",
            database: "test_db",
            schema: "public",
            viewName: "ACTIVE_USERS_VIEW",
            baseTable: "users",
            comment: "Active users semantic view",
          },
        },
      });
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get active users");

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          semantic_models: [
            { semantic_view: "test_db.public.USERS_VIEW" },
            { semantic_view: "test_db.public.ACTIVE_USERS_VIEW" },
          ],
        }),
        expect.any(Object),
      );
    });

    it("calls generateCode on Enter key press", async () => {
      const user = userEvent.setup();
      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get all users{Enter}");

      expect(mockMutate).toHaveBeenCalled();
    });
  });

  describe("Code Generation", () => {
    it("calls onCodeGenerated with generated code", async () => {
      const user = userEvent.setup();
      const onCodeGenerated = vi.fn();

      // Mock successful code generation
      mockMutate.mockImplementation((_, options) => {
        options.onSuccess({
          success: true,
          generated_code: "SELECT * FROM users WHERE active = true",
        });
      });

      render(
        <PromptGeneratorOverlay {...defaultProps} onCodeGenerated={onCodeGenerated} />,
      );

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get active users");

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      await waitFor(() => {
        expect(onCodeGenerated).toHaveBeenCalledWith(
          "SELECT * FROM users WHERE active = true",
        );
      });
    });

    it("strips markdown code blocks from generated code", async () => {
      const user = userEvent.setup();
      const onCodeGenerated = vi.fn();

      mockMutate.mockImplementation((_, options) => {
        options.onSuccess({
          success: true,
          generated_code: "```sql\nSELECT * FROM users WHERE active = true\n```",
        });
      });

      render(
        <PromptGeneratorOverlay {...defaultProps} onCodeGenerated={onCodeGenerated} />,
      );

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get active users");

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      await waitFor(() => {
        expect(onCodeGenerated).toHaveBeenCalledWith(
          "SELECT * FROM users WHERE active = true",
        );
      });
    });

    it("clears input after successful code generation", async () => {
      const user = userEvent.setup();

      mockMutate.mockImplementation((_, options) => {
        options.onSuccess({
          success: true,
          generated_code: "SELECT * FROM users",
        });
      });

      render(<PromptGeneratorOverlay {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "get users");

      const buttons = screen.getAllByRole("button");
      const sendButton = buttons[buttons.length - 1];
      await user.click(sendButton);

      await waitFor(() => {
        expect(textarea).toHaveValue("");
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("calls onClose when Escape is pressed", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<PromptGeneratorOverlay {...defaultProps} onClose={onClose} />);

      await user.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Initial Prompt (Fix Error)", () => {
    it("auto-submits when initialPrompt is provided and visible", () => {
      const onInitialPromptConsumed = vi.fn();

      render(
        <PromptGeneratorOverlay
          {...defaultProps}
          initialPrompt="Fix this SQL query"
          onInitialPromptConsumed={onInitialPromptConsumed}
        />,
      );

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          user_prompt: expect.stringContaining("Fix this SQL query"),
        }),
        expect.any(Object),
      );
      expect(onInitialPromptConsumed).toHaveBeenCalled();
    });

    it("does not auto-submit when not visible", () => {
      const onInitialPromptConsumed = vi.fn();

      render(
        <PromptGeneratorOverlay
          {...defaultProps}
          visible={false}
          initialPrompt="Fix this SQL query"
          onInitialPromptConsumed={onInitialPromptConsumed}
        />,
      );

      expect(mockMutate).not.toHaveBeenCalled();
      expect(onInitialPromptConsumed).not.toHaveBeenCalled();
    });

    it("does not auto-submit when initialPrompt is null", () => {
      render(<PromptGeneratorOverlay {...defaultProps} initialPrompt={null} />);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe("State Preservation", () => {
    it("preserves prompt text when toggling visibility", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <PromptGeneratorOverlay {...defaultProps} visible={true} />,
      );

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "my prompt");

      // Hide the overlay
      rerender(<PromptGeneratorOverlay {...defaultProps} visible={false} />);

      // Show the overlay again
      rerender(<PromptGeneratorOverlay {...defaultProps} visible={true} />);

      expect(screen.getByRole("textbox")).toHaveValue("my prompt");
    });
  });
});
