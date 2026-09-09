import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source, ValidateBackend } from "~/lib/state/backendConnector";

const mockGetApiSourceWidgets = vi.fn();

vi.mock("~/lib/utils/validateBackend", async () => {
  const actual = await vi.importActual<typeof import("~/lib/utils/validateBackend")>(
    "~/lib/utils/validateBackend",
  );
  return {
    ...actual,
    getApiSourceWidgets: (
      source: Source,
      opts: { extraHeaders?: Record<string, string> },
    ) => mockGetApiSourceWidgets(source, opts),
  };
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeSource(id: string): Source {
  return {
    id,
    uuid: id,
    name: `Backend ${id}`,
    url: `https://${id}.example.com`,
    endpointHeaders: [],
  };
}

function okResult(): ValidateBackend {
  return {
    widgets: {},
    templates: [],
    agents: [],
  } as ValidateBackend;
}

type WorkerHandler = (e: MessageEvent) => Promise<void>;

async function loadWorker(): Promise<WorkerHandler> {
  vi.resetModules();
  await import("~/apiSource.worker");
  // The worker module assigns self.onmessage at top-level; in jsdom `self` === `globalThis`.
  const handler = (globalThis as unknown as { onmessage: WorkerHandler }).onmessage;
  if (!handler) throw new Error("Worker did not attach onmessage");
  return handler;
}

describe("apiSource.worker streaming partials", () => {
  let postMessageSpy: ReturnType<typeof vi.fn>;
  let originalPostMessage: typeof globalThis.postMessage;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetApiSourceWidgets.mockReset();
    postMessageSpy = vi.fn();
    originalPostMessage = globalThis.postMessage;
    (globalThis as unknown as { postMessage: typeof postMessageSpy }).postMessage =
      postMessageSpy;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (globalThis as unknown as { postMessage: typeof originalPostMessage }).postMessage =
      originalPostMessage;
    consoleErrorSpy.mockRestore();
  });

  it("emits one __partial message per source as each finishes, then a final aggregate", async () => {
    const s1 = makeSource("s1");
    const s2 = makeSource("s2");

    const d1 = deferred<ValidateBackend>();
    const d2 = deferred<ValidateBackend>();

    mockGetApiSourceWidgets.mockImplementation((source: Source) => {
      if (source.id === "s1") return d1.promise;
      if (source.id === "s2") return d2.promise;
      throw new Error(`unexpected source ${source.id}`);
    });

    const onmessage = await loadWorker();
    const done = onmessage(
      new MessageEvent("message", {
        data: { apiSources: [s1, s2], extraHeaders: {} },
      }),
    );

    // s2 finishes first.
    d2.resolve(okResult());
    await new Promise((r) => setTimeout(r, 800)); // wait for debounced partial to flush

    const partialsAfterS2 = postMessageSpy.mock.calls.filter(
      ([msg]) => msg?.__partial === true,
    );
    expect(partialsAfterS2).toHaveLength(1);
    expect(partialsAfterS2[0][0].apiSources).toHaveLength(1);
    expect(partialsAfterS2[0][0].apiSources[0].id).toBe("s2");
    expect(partialsAfterS2[0][0].apiSources[0].status).toBe("success");
    // No final aggregate yet — s1 is still pending.
    const finalsAfterS2 = postMessageSpy.mock.calls.filter(
      ([msg]) => msg?.__partial !== true,
    );
    expect(finalsAfterS2).toHaveLength(0);

    // Now s1 finishes.
    d1.resolve(okResult());
    await done;

    const finals = postMessageSpy.mock.calls.filter(([msg]) => msg?.__partial !== true);

    expect(finals).toHaveLength(1);
    const finalIds = finals[0][0].apiSources.map((s: Source) => s.id).sort();
    expect(finalIds).toEqual(["s1", "s2"]);
  });

  it("emits a partial with status: error for sources that throw", async () => {
    const s = makeSource("boom");

    mockGetApiSourceWidgets.mockRejectedValue(new Error("network down"));

    const onmessage = await loadWorker();
    await onmessage(
      new MessageEvent("message", {
        data: { apiSources: [s], extraHeaders: {} },
      }),
    );

    await new Promise((r) => setTimeout(r, 400)); // wait for debounced partial to flush

    const finals = postMessageSpy.mock.calls.filter(([msg]) => msg?.__partial !== true);
    expect(finals).toHaveLength(1);
    expect(finals[0][0].apiSources[0].id).toBe("boom");
    expect(finals[0][0].apiSources[0].status).toBe("error");
  });

  it("emits only a final aggregate (no partials) when given an empty apiSources array", async () => {
    const onmessage = await loadWorker();
    await onmessage(
      new MessageEvent("message", {
        data: { apiSources: [], extraHeaders: {} },
      }),
    );

    const partials = postMessageSpy.mock.calls.filter(
      ([msg]) => msg?.__partial === true,
    );
    const finals = postMessageSpy.mock.calls.filter(([msg]) => msg?.__partial !== true);

    expect(partials).toHaveLength(0);
    expect(finals).toHaveLength(1);
    expect(finals[0][0].apiSources).toEqual([]);
    expect(mockGetApiSourceWidgets).not.toHaveBeenCalled();
  });
});
