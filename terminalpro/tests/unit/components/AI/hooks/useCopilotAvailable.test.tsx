import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCopilotAvailable,
  useCopilotAvailable,
} from "~/components/AI/hooks/useCopilotAvailable";
import useGetAiAgents from "~/components/AI/hooks/useGetAiAgents";
import type { Copilot, ExternalCopilotHolder } from "~/lib/state/copilot";
import { useCopilotStore } from "~/lib/state/copilot";
import { mockConfig } from "../../../../mocks/runtimeConfig";

// Mock only the hook (default export); keep selectExternalCopilots real for isCopilotAvailable.
vi.mock("~/components/AI/hooks/useGetAiAgents", async (importActual) => {
  const actual =
    await importActual<typeof import("~/components/AI/hooks/useGetAiAgents")>();
  return { ...actual, default: vi.fn(() => [] as Copilot[]) };
});

const mockedUseGetAiAgents = vi.mocked(useGetAiAgents);

const holder = (
  enabled: boolean,
  copilots: Copilot[] = [{ id: "rita" } as Copilot],
): ExternalCopilotHolder => ({ enabled, copilots }) as ExternalCopilotHolder;

describe("isCopilotAvailable", () => {
  beforeEach(() => {
    useCopilotStore.setState({ externalCopilotHolders: [] });
    mockConfig.copilot.enabled = true;
    mockConfig.copilot.openbbCopilot = true;
  });

  it("returns false when copilot is disabled", () => {
    mockConfig.copilot.enabled = false;
    expect(isCopilotAvailable()).toBe(false);
  });

  it("returns true with the OpenBB default copilot and no custom agents", () => {
    mockConfig.copilot.openbbCopilot = true;
    expect(isCopilotAvailable()).toBe(true);
  });

  it("returns false when openbbCopilot is off and there are no custom agents", () => {
    mockConfig.copilot.openbbCopilot = false;
    expect(isCopilotAvailable()).toBe(false);
  });

  it("returns true when a custom agent is connected (openbbCopilot off)", () => {
    mockConfig.copilot.openbbCopilot = false;
    useCopilotStore.setState({ externalCopilotHolders: [holder(true)] });
    expect(isCopilotAvailable()).toBe(true);
  });

  it("excludes holders with enabled:false", () => {
    mockConfig.copilot.openbbCopilot = false;
    useCopilotStore.setState({ externalCopilotHolders: [holder(false)] });
    expect(isCopilotAvailable()).toBe(false);
  });
});

describe("useCopilotAvailable", () => {
  beforeEach(() => {
    mockConfig.copilot.enabled = true;
    mockedUseGetAiAgents.mockReturnValue([]);
  });

  it("returns false when there are no usable agents", () => {
    mockedUseGetAiAgents.mockReturnValue([]);
    const { result } = renderHook(() => useCopilotAvailable());
    expect(result.current).toBe(false);
  });

  it("returns true when enabled and at least one agent exists", () => {
    mockedUseGetAiAgents.mockReturnValue([{ id: "rita" } as Copilot]);
    const { result } = renderHook(() => useCopilotAvailable());
    expect(result.current).toBe(true);
  });

  it("returns false when disabled even with agents", () => {
    mockConfig.copilot.enabled = false;
    mockedUseGetAiAgents.mockReturnValue([{ id: "rita" } as Copilot]);
    const { result } = renderHook(() => useCopilotAvailable());
    expect(result.current).toBe(false);
  });
});
