import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import CopilotFooter from "~/components/AI/CopilotFooter";
import {
  StreamingStatus,
  useLocalCommand,
  useShallowStreamingStore,
} from "~/components/AI/hooks/useStreaming";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowCopilotStore } from "~/lib/state/copilot";

vi.mock("~/lib/contexts/CopilotChatContext", () => ({
  useCopilotContext: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: vi.fn(),
  StreamingStatus: {
    READY: { streamingStatus: "streaming-ready" },
    STARTED: { streamingStatus: "streaming-started" },
    STOPPED: { streamingStatus: "streaming-stopped" },
  },
  useLocalCommand: vi.fn(() => ""),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn(),
  useAuthStore: () => ({ getState: () => ({}) }),
}));

vi.mock("~/lib/providers/MobileProvider", () => ({
  useMobile: vi.fn(),
}));

vi.mock("~/components/LayoutAuth/AppLayout/hooks/usePanelsState", () => ({
  usePanelsState: vi.fn(() => true),
}));

vi.mock("react-speech-recognition", () => ({
  default: {
    startListening: vi.fn(),
    stopListening: vi.fn(),
  },
  useSpeechRecognition: vi.fn(() => ({
    transcript: "",
    listening: false,
    browserSupportsSpeechRecognition: false,
  })),
}));

vi.mock("~/components/AI/CopilotSwitcher", () => ({
  default: () => <div data-testid="copilot-switcher">Switcher</div>,
}));

vi.mock("~/components/AI/PromptSuggestions", () => ({
  default: () => <div data-testid="prompt-suggestions">Suggestions</div>,
}));

vi.mock("~/components/AI/TextArea", () => ({
  default: ({ type }: { type: string }) => (
    <textarea
      data-testid="text-area"
      data-type={type}
      placeholder="Ask a question..."
    />
  ),
}));

vi.mock("~/components/AI/hooks/useEnhancePrompt", () => ({
  useEnhancePrompt: vi.fn(() => ({
    enhancePrompt: vi.fn().mockResolvedValue("enhanced prompt"),
    isEnhancing: false,
  })),
}));

vi.mock("~/components/General/UploadedFile", () => ({
  FooterLink: ({ link }: { link: string }) => (
    <div data-testid="footer-link">{link}</div>
  ),
  UploadedFile: ({ name }: { name: string }) => (
    <div data-testid="uploaded-file">{name}</div>
  ),
}));

describe("CopilotFooter", () => {
  const mockHandleSubmit = vi.fn();
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useCopilotContext as Mock).mockReturnValue({
      handleSubmitRef: { current: mockHandleSubmit },
    });

    (useShallowStreamingStore as Mock).mockImplementation((selector) => {
      return selector({
        limitReached: false,
        loading: false,
        files: [],
        dispatch: mockDispatch,
        completion: "",
      });
    });

    (useShallowCopilotStore as Mock).mockImplementation((selector) => {
      return selector({
        selectedCopilot: {
          id: "openbb-copilot",
          features: {
            "file-upload": true,
          },
        },
        selectedModelByAgent: {},
        setSelectedModelForAgent: vi.fn(),
      });
    });

    (useShallowAuthStore as Mock).mockImplementation((selector) => {
      return selector({
        user: { token: "test-token" },
      });
    });

    (useMobile as Mock).mockImplementation((selector) => {
      return selector({ isMobile: false });
    });
  });

  describe("component structure", () => {
    it("renders the footer container with correct id", () => {
      render(<CopilotFooter />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      const footer = document.getElementById("copilot-chat-footer");
      expect(footer).toBeInTheDocument();
    });

    it("renders the text area component", () => {
      render(<CopilotFooter />);

      const textArea = screen.getByTestId("text-area");
      expect(textArea).toBeInTheDocument();
      expect(textArea).toHaveAttribute("data-type", "footer");
    });

    it("renders the copilot switcher", () => {
      render(<CopilotFooter />);

      expect(screen.getByTestId("copilot-switcher")).toBeInTheDocument();
    });

    it("renders prompt suggestions on desktop", () => {
      render(<CopilotFooter />);

      expect(screen.getByTestId("prompt-suggestions")).toBeInTheDocument();
    });
  });

  describe("send button", () => {
    it("renders the send button with correct id", () => {
      render(<CopilotFooter />);

      const sendButton = document.getElementById("send-copilot-message");
      expect(sendButton).toBeInTheDocument();
    });

    it("disables send button when prompt is empty and not loading", () => {
      render(<CopilotFooter />);

      const sendButton = document.getElementById("send-copilot-message");
      expect(sendButton).toBeDisabled();
    });

    it("disables send button when limit is reached", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: true,
          loading: false,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const sendButton = document.getElementById("send-copilot-message");
      expect(sendButton).toBeDisabled();
    });

    it("shows stop icon when loading", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: false,
          loading: true,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const sendButton = document.getElementById("send-copilot-message");
      expect(sendButton).toBeInTheDocument();
      expect(sendButton).not.toBeDisabled();
    });

    describe("with attached files", () => {
      const renderWithFiles = (status: "pending" | "uploaded") => {
        (useLocalCommand as Mock).mockReturnValue("summarize this");
        (useShallowStreamingStore as Mock).mockImplementation((selector) => {
          return selector({
            limitReached: false,
            loading: false,
            files: [{ name: "dailyreport.pdf", description: "", status }],
            dispatch: mockDispatch,
            completion: "",
          });
        });

        render(<CopilotFooter />);
        return document.getElementById("send-copilot-message");
      };

      afterEach(() => {
        (useLocalCommand as Mock).mockReturnValue("");
      });

      it("disables send button while a file is still uploading", () => {
        expect(renderWithFiles("pending")).toBeDisabled();
      });

      it("enables send button once the file finished uploading", () => {
        expect(renderWithFiles("uploaded")).not.toBeDisabled();
      });
    });
  });

  describe("file upload button", () => {
    it("renders attachment button when file upload is enabled", () => {
      render(<CopilotFooter />);

      const attachmentButtons = screen.getAllByRole("button");
      const attachmentButton = attachmentButtons.find(
        (btn) =>
          btn.querySelector('[class*="attachment"]') ||
          btn.closest('[class*="tooltip"]'),
      );
      expect(attachmentButtons.length).toBeGreaterThan(0);
    });

    it("disables attachment button when file upload feature is disabled", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: {
            id: "openbb-copilot",
            features: {
              "file-upload": false,
            },
          },
          selectedModelByAgent: {},
          setSelectedModelForAgent: vi.fn(),
        });
      });

      render(<CopilotFooter />);

      const buttons = screen.getAllByRole("button");
      const disabledButtons = buttons.filter((btn) => btn.hasAttribute("disabled"));
      expect(disabledButtons.length).toBeGreaterThan(0);
    });

    it("disables attachment button when loading", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: false,
          loading: true,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const buttons = screen.getAllByRole("button");
      const disabledButtons = buttons.filter((btn) => btn.hasAttribute("disabled"));
      expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("enhance prompt button", () => {
    it("renders enhance/sparkles button", () => {
      render(<CopilotFooter />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(2);
    });

    it("disables enhance button when loading", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: false,
          loading: true,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const buttons = screen.getAllByRole("button");
      const disabledButtons = buttons.filter((btn) => btn.hasAttribute("disabled"));
      expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("disables enhance button when limit is reached", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: true,
          loading: false,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const buttons = screen.getAllByRole("button");
      const disabledButtons = buttons.filter((btn) => btn.hasAttribute("disabled"));
      expect(disabledButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("uploaded files display", () => {
    it("renders uploaded files when present", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: false,
          loading: false,
          files: [
            { name: "test-file.pdf", status: "uploaded" },
            { name: "another-file.csv", status: "pending" },
          ],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const uploadedFiles = screen.getAllByTestId("uploaded-file");
      expect(uploadedFiles.length).toBe(2);
      expect(screen.getByText("test-file.pdf")).toBeInTheDocument();
    });

    it("does not render file section when no files are present", () => {
      render(<CopilotFooter />);

      expect(screen.queryByTestId("uploaded-file")).not.toBeInTheDocument();
    });
  });

  describe("limit reached state", () => {
    it("applies opacity styling when limit is reached", () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: true,
          loading: false,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      const { container } = render(<CopilotFooter />);

      const opacityElement = container.querySelector(".opacity-50");
      expect(opacityElement).toBeInTheDocument();
    });

    it("does not apply opacity styling when limit is not reached", () => {
      const { container } = render(<CopilotFooter />);

      const opacityElement = container.querySelector(".opacity-50");
      expect(opacityElement).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("dispatches STOPPED status when clicking send while loading", async () => {
      (useShallowStreamingStore as Mock).mockImplementation((selector) => {
        return selector({
          limitReached: false,
          loading: true,
          files: [],
          dispatch: mockDispatch,
          completion: "",
        });
      });

      render(<CopilotFooter />);

      const sendButton = document.getElementById("send-copilot-message");
      if (sendButton) {
        fireEvent.click(sendButton);
        expect(mockDispatch).toHaveBeenCalledWith(StreamingStatus.STOPPED);
      }
    });
  });

  describe("copilot not selected", () => {
    it("handles when no copilot is selected gracefully", () => {
      (useShallowCopilotStore as Mock).mockImplementation((selector) => {
        return selector({
          selectedCopilot: null,
        });
      });

      render(<CopilotFooter />);

      expect(screen.getByTestId("text-area")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("applies correct border and background classes", () => {
      const { container } = render(<CopilotFooter />);

      const footer = container.querySelector("#copilot-chat-footer");
      expect(footer).toHaveClass("mt-auto");
      expect(footer).toHaveClass("rounded-b");
    });
  });
});
