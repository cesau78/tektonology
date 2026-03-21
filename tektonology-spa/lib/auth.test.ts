import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRole, canAccessFinance, canWrite, isAuthenticated } from "./auth";

const mockUseAuth0 = vi.fn();

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => mockUseAuth0(),
}));

describe("useRole", () => {
  it("returns anonymous with isLoaded false while loading", () => {
    mockUseAuth0.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: undefined,
    });
    const { result } = renderHook(() => useRole());
    expect(result.current).toEqual({ role: "anonymous", isLoaded: false });
  });

  it("returns anonymous with isLoaded true when not authenticated", () => {
    mockUseAuth0.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: undefined,
    });
    const { result } = renderHook(() => useRole());
    expect(result.current).toEqual({ role: "anonymous", isLoaded: true });
  });

  it("returns anonymous with isLoaded true when authenticated but no user", () => {
    mockUseAuth0.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: undefined,
    });
    const { result } = renderHook(() => useRole());
    expect(result.current).toEqual({ role: "anonymous", isLoaded: true });
  });

  it("returns role from claim when present", () => {
    mockUseAuth0.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { "https://tektonology.com/role": "owner" },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current).toEqual({ role: "owner", isLoaded: true });
  });

  it("defaults to member when claim is missing", () => {
    mockUseAuth0.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { name: "Test User" },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current).toEqual({ role: "member", isLoaded: true });
  });

  it("returns auditor role from claim", () => {
    mockUseAuth0.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { "https://tektonology.com/role": "auditor" },
    });
    const { result } = renderHook(() => useRole());
    expect(result.current).toEqual({ role: "auditor", isLoaded: true });
  });
});

describe("canAccessFinance", () => {
  it("returns true for owner", () => {
    expect(canAccessFinance("owner")).toBe(true);
  });

  it("returns true for auditor", () => {
    expect(canAccessFinance("auditor")).toBe(true);
  });

  it("returns false for member", () => {
    expect(canAccessFinance("member")).toBe(false);
  });

  it("returns false for anonymous", () => {
    expect(canAccessFinance("anonymous")).toBe(false);
  });
});

describe("canWrite", () => {
  it("returns true for owner", () => {
    expect(canWrite("owner")).toBe(true);
  });

  it("returns false for auditor", () => {
    expect(canWrite("auditor")).toBe(false);
  });

  it("returns false for member", () => {
    expect(canWrite("member")).toBe(false);
  });

  it("returns false for anonymous", () => {
    expect(canWrite("anonymous")).toBe(false);
  });
});

describe("isAuthenticated", () => {
  it("returns false for anonymous", () => {
    expect(isAuthenticated("anonymous")).toBe(false);
  });

  it("returns true for member", () => {
    expect(isAuthenticated("member")).toBe(true);
  });

  it("returns true for owner", () => {
    expect(isAuthenticated("owner")).toBe(true);
  });

  it("returns true for auditor", () => {
    expect(isAuthenticated("auditor")).toBe(true);
  });
});
