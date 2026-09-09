import { render, screen } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { useDropzone } from "react-dropzone";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotDropzone } from "~/components/AI/CopilotDropzone";
import useQueriesLeft from "~/components/AI/hooks/useQueriesLeft";
import { useShallowStreamingStore } from "~/components/AI/hooks/useStreaming";
import { useUploadDocuments } from "~/components/AI/hooks/useUploadDocuments";
import { useShallowCopilotStore } from "~/lib/state/copilot";

// Mock dependencies
vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: vi.fn(),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useQueriesLeft", () => ({
  default: vi.fn(),
}));

const mockUploadDocuments = vi.fn().mockResolvedValue(undefined);

vi.mock("~/components/AI/hooks/useUploadDocuments", () => ({
  useUploadDocuments: vi.fn(() => mockUploadDocuments),
}));

vi.mock("~/components/AI/DragFileHere", () => ({
  default: () => <div data-testid="drag-file-here">DragFileHere Component</div>,
}));



// Mock useRef and useEffect hooks
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(actual as any),
    useRef: () => ({ current: null }),
    useEffect: vi.fn(), // Don't execute useEffect callbacks to avoid async issues
  };
});

// Mock timers to prevent async setTimeout issues
// biome-ignore lint/correctness/useHookAtTopLevel: This is a Vitest utility, not a React hook
vi.useFakeTimers();

describe("CopilotDropzone Component", () => {
  const mockChildren = <div data-testid="children">Children Content</div>;
  const mockScrollTo = vi.fn();
  const mockMessagesRefElement = {
    get scrollHeight() {
      return 100;
    },
    scrollTop: 0,
    scrollTo: mockScrollTo,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLDivElement;

  const mockMessagesRef = {
    current: mockMessagesRefElement,
  } as MutableRefObject<HTMLDivElement | null>;

  const mockGetRootProps = vi.fn();
  const mockGetInputProps = vi.fn();
  const mockRootRef = { current: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Reset the ref element properties but keep it as the same object
    mockMessagesRefElement.scrollTop = 0;

    // Mock useDropzone
    (useDropzone as Mock).mockReturnValue({
      rootRef: mockRootRef,
      getRootProps: mockGetRootProps,
      getInputProps: mockGetInputProps,
      isDragActive: false,
    });

    // Mock streaming store
    (useShallowStreamingStore as Mock).mockImplementation((selector) => {
      return selector({
        dispatch: vi.fn(),
        isDragging: false,
      });
    });

    // Mock copilot store
    (useShallowCopilotStore as Mock).mockImplementation((selector) => {
      return selector({
        selectedCopilot: {
          features: {
            "file-upload": true,
          },
        },
        showWelcome: false,
      });
    });

    // Mock queries left hook
    (useQueriesLeft as Mock).mockReturnValue({
      queriesLeft: 10,
    });

    // Mock upload documents hook
    mockUploadDocuments.mockReset();
    mockUploadDocuments.mockResolvedValue(undefined);
    (useUploadDocuments as Mock).mockReturnValue(mockUploadDocuments);


    // Mock getRootProps and getInputProps
    mockGetRootProps.mockReturnValue({
      "data-testid": "dropzone-root",
    });

    mockGetInputProps.mockReturnValue({
      "data-testid": "file-input",
    });
  });

  it("renders correctly with children and messagesRef", () => {
    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    expect(screen.getByTestId("dropzone-root")).toBeInTheDocument();
    expect(screen.getByTestId("children")).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
  });

  it("displays DragFileHere component when drag is active", () => {
    // Mock drag active state
    (useDropzone as Mock).mockReturnValue({
      rootRef: mockRootRef,
      getRootProps: mockGetRootProps,
      getInputProps: mockGetInputProps,
      isDragActive: true,
    });

    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    expect(screen.getByTestId("drag-file-here")).toBeInTheDocument();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("displays children and input element when drag is not active", () => {
    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    expect(screen.getByTestId("children")).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
  });

  it("has correct accept object for all supported file types", () => {
    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    // Verify useDropzone was called with correct accept object
    expect(useDropzone).toHaveBeenCalledWith(
      expect.objectContaining({
        accept: {
          "text/plain": [".txt"],
          "text/markdown": [".md", ".markdown"],
          "application/pdf": [".pdf"],
          "text/csv": [".csv"],
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            ".xlsx",
          ],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx",
          ],
          "text/html": [".html"],
        },
      }),
    );
  });

  it("disables dropzone when no copilot selected or queries left is 0", () => {
    // Mock disabled state
    (useShallowCopilotStore as Mock).mockImplementation((selector) => {
      return selector({
        selectedCopilot: null,
        showWelcome: false,
      });
    });

    (useQueriesLeft as Mock).mockReturnValue({
      queriesLeft: 0,
    });

    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    // Verify useDropzone was called with disabled true
    expect(useDropzone).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
      }),
    );
  });

  it("should handle unicode filenames correctly in onDrop", () => {
    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    // Get the onDrop function from the useDropzone mock
    const onDrop = (useDropzone as Mock).mock.calls[0][0].onDrop;

    // Create a mock file with unicode name
    const mockFile = new File(["content"], "Библиография для диссертации.md", {
      type: "text/markdown",
    });

    // Call onDrop with the mock file
    onDrop([mockFile]);

    // Verify uploadDocuments was called with the slugified filename
    expect(mockUploadDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "библиография_для_диссертации.md",
      }),
    ]);
  });

  it("should handle special characters in filenames correctly in onDrop", () => {
    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    // Get the onDrop function from the useDropzone mock
    const onDrop = (useDropzone as Mock).mock.calls[0][0].onDrop;

    // Create a mock file with special characters
    const mockFile = new File(["content"], "My File (1).txt", {
      type: "text/plain",
    });

    // Call onDrop with the mock file
    onDrop([mockFile]);

    // Verify uploadDocuments was called with the slugified filename
    expect(mockUploadDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "my_file_1.txt",
      }),
    ]);
  });

  it("should handle filenames with multiple periods correctly in onDrop", () => {
    render(
      <CopilotDropzone messagesRef={mockMessagesRef}>{mockChildren}</CopilotDropzone>,
    );

    // Get the onDrop function from the useDropzone mock
    const onDrop = (useDropzone as Mock).mock.calls[0][0].onDrop;

    // Create a mock file with multiple periods
    const mockFile = new File(["content"], "my.cool.file.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Call onDrop with the mock file
    onDrop([mockFile]);

    // Verify uploadDocuments was called with the slugified filename
    expect(mockUploadDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "my.cool.file.xlsx",
      }),
    ]);
  });
});
