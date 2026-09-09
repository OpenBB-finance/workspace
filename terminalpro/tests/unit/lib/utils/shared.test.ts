import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { duplicateDashboard } from "~/lib/utils/shared";

const addTabMock = vi.fn();
vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      addTab: addTabMock,
    })),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mocked-uuid"),
}));

describe("shared utils", () => {
  it("should duplicate a dashboard correctly", () => {
    const item = {
      data: {
        name: "Test Dashboard",
        widgets: [],
        groups: {},
        gridLayout: [],
      },
    };

    const id = duplicateDashboard(item);

    expect(id).toBe("mocked-uuid");
    expect(addTabMock).toHaveBeenCalledWith({
      index: "mocked-uuid",
      data: {
        name: "Test Dashboard (Duplicate)",
        type: "custom",
        widgets: [],
        groups: {},
        gridLayout: [],
      },
    });
    expect(toast.success).toHaveBeenCalled();
  });
});
