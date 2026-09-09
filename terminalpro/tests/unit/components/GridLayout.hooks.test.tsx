import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { useDragAndDropFiles } from "~/components/GridLayout.hooks";

vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useParams: () => ({ id: "tab-1" }),
}));

vi.mock("~/api/api", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("~/api/auth.api", () => ({
  getFileWidgets: vi.fn(),
  postFileWidget: vi.fn(),
}));

vi.mock("~/components/DataConnectors/FileContext", () => ({
  useFileContext: () => ({
    files: [],
    setFiles: vi.fn(),
  }),
}));

vi.mock("~/hooks/useIsMobile", () => ({
  default: () => false,
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({
    copilot: {
      enabled: false,
      aiEnhancements: false,
    },
  }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: (state: { addWidget: Mock }) => unknown) =>
    selector({ addWidget: vi.fn() as Mock }),
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: (state: { user: { token: string } }) => unknown) =>
    selector({ user: { token: "token" } }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (
    selector: (state: { setStoredFiles: Mock }) => unknown,
  ) => selector({ setStoredFiles: vi.fn() as Mock }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (state: { aiEnhancements: boolean }) => unknown) =>
    selector({ aiEnhancements: false }),
}));

vi.mock("~/lib/utils", () => ({
  uuidv4: () => "uuid",
}));

vi.mock("~/lib/contexts/TabContext", () => ({
  useTabContext: () => ({
    isShared: false,
  }),
}));

describe("useDragAndDropFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDropzone as Mock).mockReturnValue({
      getRootProps: vi.fn(),
      getInputProps: vi.fn(),
      isDragActive: false,
    });
  });

  it("uses the DOCX MIME type in the dashboard dropzone accept config", () => {
    renderHook(() => useDragAndDropFiles(false));

    expect(useDropzone).toHaveBeenCalledWith(
      expect.objectContaining({
        accept: expect.objectContaining({
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx",
          ],
        }),
      }),
    );
  });
});
