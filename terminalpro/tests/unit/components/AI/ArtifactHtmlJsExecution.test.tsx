import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Artifact from "~/components/AI/Artifact";
import type { ArtifactT } from "~/lib/state/copilot";
import { mockConfig } from "../../../mocks/runtimeConfig";

describe("Artifact HTML JavaScript execution", () => {
  beforeEach(() => {
    mockConfig.data.allowHtmlJsExecution = true;
  });

  afterEach(() => {
    mockConfig.data.allowHtmlJsExecution = false;
  });

  it("measures html artifact height on iframe load when JavaScript execution is enabled", async () => {
    const artifact: ArtifactT = {
      uuid: "html-js-123",
      type: "html",
      content: "<html><body><h1>Report</h1></body></html>",
      name: "HTML JS Artifact",
      description: "This is a JavaScript-enabled HTML artifact",
    };

    const { container } = render(<Artifact artifact={artifact} inAiMessage={true} />);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    Object.defineProperty(doc?.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(doc?.body, "scrollHeight", {
      configurable: true,
      value: 2000,
    });

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(iframe).toHaveStyle({ height: "600px" });
    });
  }, 15000);

  it("does not measure html artifacts outside AI messages on iframe load when JavaScript execution is enabled", async () => {
    const artifact: ArtifactT = {
      uuid: "html-js-456",
      type: "html",
      content: "<html><body><h1>Report</h1></body></html>",
      name: "Standalone HTML JS Artifact",
      description: "This is a standalone JavaScript-enabled HTML artifact",
    };

    const { container } = render(<Artifact artifact={artifact} />);
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    Object.defineProperty(doc?.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(doc?.body, "scrollHeight", {
      configurable: true,
      value: 2000,
    });

    fireEvent.load(iframe);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(iframe).toHaveStyle({ minHeight: "50px" });
    expect(iframe).not.toHaveStyle({ height: "600px" });
  }, 15000);
});
