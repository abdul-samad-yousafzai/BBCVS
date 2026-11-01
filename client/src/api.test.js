import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("API base URL", () => {
  it("uses the same origin when VITE_API_BASE_URL is empty", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { checkHealth } = await import("./api.js");
    await checkHealth();

    expect(fetchMock).toHaveBeenCalledWith("/health", {});
  });
});
