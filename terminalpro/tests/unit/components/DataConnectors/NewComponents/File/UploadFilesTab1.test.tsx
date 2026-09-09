import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { useDropzone } from "react-dropzone";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import UploadFilesTab1 from "~/components/DataConnectors/NewComponents/File/UploadFilesTab1";

vi.mock("react-dropzone", () => ({
  useDropzone: vi.fn(),
}));

vi.mock("~/api/api", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("~/api/auth.api", () => ({
  deleteUploadedFile: vi.fn(),
}));

vi.mock("~/components/AI/DragFileHere", () => ({
  default: () => <div>Drag file here</div>,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock("~/components/ds/molecules/Form", () => ({
  FormMessage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/General/UploadedFile", () => ({
  UploadedFile: () => null,
}));

vi.mock("~/components/Icon", () => ({
  default: () => <div>Icon</div>,
}));

vi.mock("~/components/DataConnectors/FileContext", () => ({
  useFileContext: () => ({
    files: [],
    setFiles: vi.fn(),
  }),
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({
    copilot: {
      enabled: false,
      aiEnhancements: false,
    },
    urls: {
      ai: "https://example.test",
    },
  }),
}));

vi.mock("~/lib/state/backendConnector", () => ({}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: (state: { user: { token: string } }) => unknown) =>
    selector({ user: { token: "token" } }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (
    selector: (state: { aiEnhancements: boolean }) => unknown,
  ) => selector({ aiEnhancements: false }),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
  formatFileSize: () => "25 MB",
}));

vi.mock("react-hook-form", () => ({
  useFormContext: () => ({
    setValue: vi.fn(),
    formState: {
      errors: {},
    },
  }),
}));

describe("UploadFilesTab1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDropzone as Mock).mockReturnValue({
      getRootProps: vi.fn(() => ({ "data-testid": "upload-root" })),
      getInputProps: vi.fn(() => ({ "data-testid": "upload-input" })),
      isDragActive: false,
    });
  });

  it("uses the DOCX MIME type in the file upload accept config", () => {
    render(<UploadFilesTab1 next={vi.fn()} />);

    expect(useDropzone).toHaveBeenCalledWith(
      expect.objectContaining({
        accept: expect.objectContaining({
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            [".docx"],
        }),
      }),
    );
  });
});
