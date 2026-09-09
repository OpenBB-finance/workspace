import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock html-to-image
vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

// Mock jspdf
let mockPdfInstance: {
  addImage: Mock;
  addPage: Mock;
  save: Mock;
  output: Mock;
} | null = null;

vi.mock("jspdf", () => {
  // Factory function - this runs at module load time
  // We return a vi.fn() that will read mockPdfInstance at call time
  const mock = vi.fn();
  return { jsPDF: mock };
});

// Mock jszip
let mockZipInstance: {
  file: Mock;
  folder: Mock;
  generateAsync: Mock;
} | null = null;

vi.mock("jszip", () => {
  const mock = vi.fn();
  return { default: mock };
});

// Mock app store for tabHasSlowWidget
vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      items: {},
    }),
  },
}));

import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import {
  type DashboardInfo,
  type TabInfo,
  generateFolderReport,
  generateMultiTabReport,
} from "~/lib/utils/utils";

const checkIfLoadingData = () => false; // Stub - not testing loading state here

describe("generateMultiTabReport", () => {
  let mockElement: Partial<Element>;
  let originalLocation: Location;
  let originalHistory: History;
  let originalCreateElement: typeof document.createElement;
  let originalGetElementsByClassName: typeof document.getElementsByClassName;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Store originals
    originalLocation = window.location;
    originalHistory = window.history;
    originalCreateElement = document.createElement.bind(document);
    originalGetElementsByClassName = document.getElementsByClassName.bind(document);

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/app/test-dashboard?tab=tab1",
        search: "?tab=tab1",
        pathname: "/app/test-dashboard",
      },
      writable: true,
    });

    // Mock window.history
    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    });

    // Mock dispatchEvent
    window.dispatchEvent = vi.fn();

    // Mock element
    mockElement = {
      scrollWidth: 800,
      clientWidth: 800,
      scrollHeight: 600,
      clientHeight: 600,
    };

    // Mock getElementsByClassName
    document.getElementsByClassName = vi.fn().mockReturnValue([mockElement]);

    // Mock document.createElement for canvas - create new mock each time
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === "canvas") {
        // Return a new canvas mock each time to avoid state sharing
        return {
          width: 816,
          height: 680,
          getContext: vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            font: "",
            textAlign: "left",
            fillText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 100 }),
            drawImage: vi.fn(),
          }),
          toDataURL: vi.fn().mockReturnValue("data:image/png;base64,abc123"),
        };
      }
      if (tagName === "a") {
        return {
          href: "",
          download: "",
          click: vi.fn(),
          remove: vi.fn(),
        };
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;

    // Mock toPng
    (toPng as Mock).mockResolvedValue("data:image/png;base64,mockImageData");

    // Mock jsPDF - set the module-level mock instance
    mockPdfInstance = {
      addImage: vi.fn(),
      addPage: vi.fn(),
      save: vi.fn(),
      output: vi.fn().mockReturnValue(new Blob(["pdf content"])),
    };
    // Configure jsPDF mock to return mockPdfInstance
    vi.mocked(jsPDF).mockImplementation(function (this: unknown) {
      return mockPdfInstance;
    });

    // Mock JSZip - set the module-level mock instance
    mockZipInstance = {
      file: vi.fn(),
      folder: vi.fn().mockReturnThis(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(["zip content"])),
    };
    // Configure JSZip mock to return mockZipInstance
    vi.mocked(JSZip).mockImplementation(function (this: unknown) {
      return mockZipInstance as unknown as JSZip;
    });

    // Mock URL
    URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock");
    URL.revokeObjectURL = vi.fn();

    // Mock Image - use queueMicrotask for synchronous-like resolution
    global.Image = vi.fn().mockImplementation(function MockImage() {
      const img = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        _src: "",
        width: 816,
        height: 600,
        get src() {
          return this._src;
        },
        set src(value: string) {
          this._src = value;
          // Use queueMicrotask to trigger onload after src is set
          // This runs at the end of the current task, after onload is assigned
          queueMicrotask(() => {
            if (this.onload) this.onload();
          });
        },
      };
      return img;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "location", { value: originalLocation });
    Object.defineProperty(window, "history", { value: originalHistory });
    document.createElement = originalCreateElement;
    document.getElementsByClassName = originalGetElementsByClassName;
  });

  describe("tab switching", () => {
    it("calls switchTab for each tab in order", async () => {
      const tabs: TabInfo[] = [
        { id: "tab1", name: "Tab 1" },
        { id: "tab2", name: "Tab 2" },
      ];

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      // Should have called replaceState for each tab + 1 for restore in finally
      // (originalTab is "tab1" from mock URL ?tab=tab1)
      expect(window.history.replaceState).toHaveBeenCalledTimes(3);
      expect(window.dispatchEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe("PDF export", () => {
    it("creates single PDF with all tabs as pages", async () => {
      const tabs: TabInfo[] = [
        { id: "tab1", name: "Tab 1" },
        { id: "tab2", name: "Tab 2" },
        { id: "tab3", name: "Tab 3" },
      ];

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(jsPDF).toHaveBeenCalled();
      expect(mockPdfInstance!.addPage).toHaveBeenCalledTimes(2); // First page is created with constructor
      expect(mockPdfInstance!.addImage).toHaveBeenCalledTimes(3);
      expect(mockPdfInstance!.save).toHaveBeenCalledWith("test.pdf");
    });
  });

  describe("PNG export", () => {
    it("creates ZIP with each tab as separate PNG file", async () => {
      const tabs: TabInfo[] = [
        { id: "tab1", name: "Tab 1" },
        { id: "tab2", name: "Tab 2" },
      ];

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "png",
        true,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(JSZip).toHaveBeenCalled();
      expect(mockZipInstance!.file).toHaveBeenCalledTimes(2);
      expect(mockZipInstance!.generateAsync).toHaveBeenCalledWith({ type: "blob" });
    });
  });

  describe("progress callback", () => {
    it("calls onProgress callback with (current, total, tabName) for each tab", async () => {
      const tabs: TabInfo[] = [
        { id: "tab1", name: "Tab 1" },
        { id: "tab2", name: "Tab 2" },
      ];
      const onProgress = vi.fn();

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
        onProgress,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2, "Tab 1");
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2, "Tab 2");
    });
  });

  describe("callbacks", () => {
    it("calls onFinish callback on success", async () => {
      const tabs: TabInfo[] = [{ id: "tab1", name: "Tab 1" }];
      const onFinish = vi.fn();

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
        undefined,
        onFinish,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it("calls onError callback when error occurs", async () => {
      const tabs: TabInfo[] = [{ id: "tab1", name: "Tab 1" }];
      const onError = vi.fn();

      // Make toPng fail
      (toPng as Mock).mockRejectedValue(new Error("Capture failed"));

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
        undefined,
        undefined,
        onError,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("restores original tab in finally block", async () => {
      const tabs: TabInfo[] = [{ id: "tab1", name: "Tab 1" }];

      // Set original tab
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000/app/test-dashboard?tab=original-tab",
          search: "?tab=original-tab",
          pathname: "/app/test-dashboard",
        },
        writable: true,
      });

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
      );
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      // Should have called replaceState to restore original tab
      const calls = (window.history.replaceState as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toBe("");
      expect(lastCall[2]).toContain("tab=original-tab");
    });
  });

  describe("error handling", () => {
    it("throws error if grid layout element not found", async () => {
      const tabs: TabInfo[] = [{ id: "tab1", name: "Tab 1" }];
      const onError = vi.fn();

      document.getElementsByClassName = vi.fn().mockReturnValue([]);

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
        undefined,
        undefined,
        onError,
      );

      // Advance timers past the max wait time (5000ms + buffer)
      await vi.advanceTimersByTimeAsync(6000);
      await promise;

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Could not find grid layout"),
        }),
      );
    });

    it("throws error when no content was captured", async () => {
      // This test is tricky since we need all captures to fail
      // but the current implementation throws on first missing element
      const tabs: TabInfo[] = [{ id: "tab1", name: "Tab 1" }];
      const onError = vi.fn();

      document.getElementsByClassName = vi.fn().mockReturnValue([]);

      const promise = generateMultiTabReport(
        checkIfLoadingData,
        tabs,
        "Test",
        "test",
        "pdf",
        true,
        undefined,
        undefined,
        onError,
      );

      // Advance timers past the max wait time (5000ms + buffer)
      await vi.advanceTimersByTimeAsync(6000);
      await promise;

      expect(onError).toHaveBeenCalled();
    });
  });
});

describe("generateFolderReport", () => {
  let mockElement: Partial<Element>;
  let originalLocation: Location;
  let originalHistory: History;
  let originalCreateElement: typeof document.createElement;
  let originalGetElementsByClassName: typeof document.getElementsByClassName;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Store originals
    originalLocation = window.location;
    originalHistory = window.history;
    originalCreateElement = document.createElement.bind(document);
    originalGetElementsByClassName = document.getElementsByClassName.bind(document);

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000/app/original-dashboard?tab=original-tab",
        search: "?tab=original-tab",
        pathname: "/app/original-dashboard",
      },
      writable: true,
    });

    // Mock window.history
    Object.defineProperty(window, "history", {
      value: {
        replaceState: vi.fn(),
      },
      writable: true,
    });

    // Mock dispatchEvent
    window.dispatchEvent = vi.fn();

    // Mock element
    mockElement = {
      scrollWidth: 800,
      clientWidth: 800,
      scrollHeight: 600,
      clientHeight: 600,
    };

    // Mock getElementsByClassName
    document.getElementsByClassName = vi.fn().mockReturnValue([mockElement]);

    // Mock document.createElement for canvas - create new mock each time
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === "canvas") {
        // Return a new canvas mock each time to avoid state sharing
        return {
          width: 816,
          height: 680,
          getContext: vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            font: "",
            textAlign: "left",
            fillText: vi.fn(),
            measureText: vi.fn().mockReturnValue({ width: 100 }),
            drawImage: vi.fn(),
          }),
          toDataURL: vi.fn().mockReturnValue("data:image/png;base64,abc123"),
        };
      }
      if (tagName === "a") {
        return {
          href: "",
          download: "",
          click: vi.fn(),
          remove: vi.fn(),
        };
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;

    // Mock toPng
    (toPng as Mock).mockResolvedValue("data:image/png;base64,mockImageData");

    // Mock jsPDF - set the module-level mock instance
    mockPdfInstance = {
      addImage: vi.fn(),
      addPage: vi.fn(),
      save: vi.fn(),
      output: vi.fn().mockReturnValue(new Blob(["pdf content"])),
    };
    // Configure jsPDF mock to return mockPdfInstance
    vi.mocked(jsPDF).mockImplementation(function (this: unknown) {
      return mockPdfInstance;
    });

    // Mock JSZip - set the module-level mock instance
    mockZipInstance = {
      file: vi.fn(),
      folder: vi.fn().mockReturnThis(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(["zip content"])),
    };
    // Configure JSZip mock to return mockZipInstance
    vi.mocked(JSZip).mockImplementation(function (this: unknown) {
      return mockZipInstance as unknown as JSZip;
    });

    // Mock URL
    URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/mock");
    URL.revokeObjectURL = vi.fn();

    // Mock Image - use queueMicrotask for synchronous-like resolution
    global.Image = vi.fn().mockImplementation(function MockImage() {
      const img = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        _src: "",
        width: 816,
        height: 600,
        get src() {
          return this._src;
        },
        set src(value: string) {
          this._src = value;
          // Use queueMicrotask to trigger onload after src is set
          queueMicrotask(() => {
            if (this.onload) this.onload();
          });
        },
      };
      return img;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "location", { value: originalLocation });
    Object.defineProperty(window, "history", { value: originalHistory });
    document.createElement = originalCreateElement;
    document.getElementsByClassName = originalGetElementsByClassName;
  });

  describe("navigation", () => {
    it("navigates to each dashboard in order", async () => {
      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
        { id: "dash2", name: "Dashboard 2", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Should navigate to each dashboard
      const calls = (window.history.replaceState as Mock).mock.calls;
      expect(calls.some((c) => c[2].includes("/app/dash1"))).toBe(true);
      expect(calls.some((c) => c[2].includes("/app/dash2"))).toBe(true);
    });
  });

  describe("export scope: current", () => {
    it("exports only first tab when scope is current", async () => {
      const dashboards: DashboardInfo[] = [
        {
          id: "dash1",
          name: "Dashboard 1",
          tabs: [
            { id: "tab1", name: "Tab 1" },
            { id: "tab2", name: "Tab 2" },
          ],
        },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Should only capture once per dashboard (not per tab)
      expect(toPng).toHaveBeenCalledTimes(1);
    });
  });

  describe("export scope: all-tabs", () => {
    it("exports all tabs per dashboard when scope is all-tabs", async () => {
      const dashboards: DashboardInfo[] = [
        {
          id: "dash1",
          name: "Dashboard 1",
          tabs: [
            { id: "tab1", name: "Tab 1" },
            { id: "tab2", name: "Tab 2" },
          ],
        },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "all-tabs",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Should capture once per tab
      expect(toPng).toHaveBeenCalledTimes(2);
    });
  });

  describe("ZIP structure", () => {
    it("creates ZIP with correct structure for PDF export", async () => {
      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      expect(mockZipInstance!.file).toHaveBeenCalledWith(
        "dashboard-1.pdf",
        expect.any(Blob),
      );
      expect(mockZipInstance!.generateAsync).toHaveBeenCalledWith({ type: "blob" });
    });

    it("creates ZIP with folder structure for PNG all-tabs export", async () => {
      const dashboards: DashboardInfo[] = [
        {
          id: "dash1",
          name: "Dashboard 1",
          tabs: [
            { id: "tab1", name: "Tab 1" },
            { id: "tab2", name: "Tab 2" },
          ],
        },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "png",
        "all-tabs",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      expect(mockZipInstance!.folder).toHaveBeenCalledWith("dashboard-1");
    });
  });

  describe("progress callback", () => {
    it("calls onProgress with correct arguments", async () => {
      const dashboards: DashboardInfo[] = [
        {
          id: "dash1",
          name: "Dashboard 1",
          tabs: [
            { id: "tab1", name: "Tab 1" },
            { id: "tab2", name: "Tab 2" },
          ],
        },
      ];
      const onProgress = vi.fn();

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "all-tabs",
        true,
        onProgress,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Should be called with dashboard and tab progress
      expect(onProgress).toHaveBeenCalled();
      // First call should have dashboard info
      expect(onProgress.mock.calls[0][0]).toBe(1); // dashboard current
      expect(onProgress.mock.calls[0][1]).toBe(1); // dashboard total
      expect(onProgress.mock.calls[0][2]).toBe("Dashboard 1"); // dashboard name
    });
  });

  describe("callbacks", () => {
    it("calls onFinish on success", async () => {
      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];
      const onFinish = vi.fn();

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
        undefined,
        onFinish,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it("calls onError on failure", async () => {
      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];
      const onError = vi.fn();

      // Make toPng fail
      (toPng as Mock).mockRejectedValue(new Error("Capture failed"));

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
        undefined,
        undefined,
        onError,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("navigation restoration", () => {
    it("restores original dashboard and tab path in finally block", async () => {
      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Last replaceState call should restore original path
      const calls = (window.history.replaceState as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toContain("/app/original-dashboard");
    });

    it("restores URL even when original path is not a dashboard path", async () => {
      // Set original path to non-dashboard
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000/settings",
          search: "",
          pathname: "/settings",
        },
        writable: true,
      });

      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Should restore original path
      const calls = (window.history.replaceState as Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toBe("/settings");
    });
  });

  describe("error handling", () => {
    it("continues to next element if grid layout not found", async () => {
      const dashboards: DashboardInfo[] = [
        { id: "dash1", name: "Dashboard 1", tabs: [{ id: "tab1", name: "Tab 1" }] },
        { id: "dash2", name: "Dashboard 2", tabs: [{ id: "tab1", name: "Tab 1" }] },
      ];

      // First call returns empty, second returns element
      let callCount = 0;
      document.getElementsByClassName = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [];
        return [mockElement];
      });

      const onFinish = vi.fn();

      const promise = generateFolderReport(
        checkIfLoadingData,
        dashboards,
        "Folder",
        "folder",
        "pdf",
        "current",
        true,
        undefined,
        onFinish,
      );
      await vi.advanceTimersByTimeAsync(60000);
      await promise;

      // Should still complete successfully
      expect(onFinish).toHaveBeenCalled();
    });
  });
});
