import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { apiFetch, authedApiFetch, useApiFetch } from "./api";

const mockGetAccessTokenSilently = vi.fn();
const mockLoginWithRedirect = vi.fn();

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getAccessTokenSilently: mockGetAccessTokenSilently,
    loginWithRedirect: mockLoginWithRedirect,
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  mockGetAccessTokenSilently.mockReset();
  mockLoginWithRedirect.mockReset();
});

describe("apiFetch", () => {
  it("returns parsed JSON on success", async () => {
    const data = { id: 1, name: "test" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await apiFetch("/items");
    expect(result).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/items",
      undefined,
    );
  });

  it("passes init options to fetch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiFetch("/items", { method: "POST", body: '{"a":1}' });
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:3001/items", {
      method: "POST",
      body: '{"a":1}',
    });
  });

  it("throws on non-ok response with status and body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });

    await expect(apiFetch("/missing")).rejects.toThrow("API 404: Not Found");
  });
});

describe("authedApiFetch", () => {
  it("adds Authorization header when token is provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    await authedApiFetch("/secure", "my-token");

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer my-token");
  });

  it("omits Authorization header when token is null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    await authedApiFetch("/public", null);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("preserves existing headers from init", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await authedApiFetch("/data", "tok", {
      headers: { "Content-Type": "application/json" },
    });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toBe("Bearer tok");
  });

  it("preserves other init options like method", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await authedApiFetch("/data", "tok", { method: "DELETE" });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("DELETE");
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server Error"),
    });

    await expect(authedApiFetch("/fail", "tok")).rejects.toThrow(
      "API 500: Server Error",
    );
  });
});

describe("useApiFetch", () => {
  it("fetches with token on success", async () => {
    mockGetAccessTokenSilently.mockResolvedValue("access-token");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 42 }),
    });

    const { result } = renderHook(() => useApiFetch());
    const fetcher = result.current;

    const data = await fetcher("/api/thing");
    expect(data).toEqual({ data: 42 });
    expect(mockGetAccessTokenSilently).toHaveBeenCalled();

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer access-token");
  });

  it("passes init options through to authedApiFetch", async () => {
    mockGetAccessTokenSilently.mockResolvedValue("tok");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useApiFetch());
    await result.current("/api/thing", { method: "PUT" });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("PUT");
  });

  it("redirects to login and throws when token acquisition fails", async () => {
    mockGetAccessTokenSilently.mockRejectedValue(new Error("login_required"));
    mockLoginWithRedirect.mockResolvedValue(undefined);

    Object.defineProperty(window, "location", {
      value: { pathname: "/dashboard" },
      writable: true,
    });

    const { result } = renderHook(() => useApiFetch());
    const fetcher = result.current;

    await expect(fetcher("/api/thing")).rejects.toThrow(
      "Redirecting to login",
    );
    expect(mockLoginWithRedirect).toHaveBeenCalledWith({
      appState: { returnTo: "/dashboard" },
    });
  });
});
