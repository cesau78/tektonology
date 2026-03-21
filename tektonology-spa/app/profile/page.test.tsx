import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

const mockUseAuth0 = vi.fn();
vi.mock("@auth0/auth0-react", () => ({ useAuth0: () => mockUseAuth0() }));

const mockUseRole = vi.fn();
vi.mock("@/lib/auth", () => ({
  useRole: () => mockUseRole(),
  canAccessFinance: (role: string) => role === "owner" || role === "auditor",
  canWrite: (role: string) => role === "owner",
}));

vi.mock("@/components/auth-guard", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ProfilePage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePage", () => {
  it("renders null when user is undefined", () => {
    mockUseAuth0.mockReturnValue({ user: undefined });
    mockUseRole.mockReturnValue({ role: "anonymous", isLoaded: true });
    const { container } = render(<ProfilePage />);
    expect(container.innerHTML).toBe("");
  });

  it("renders member profile with name and email", () => {
    mockUseAuth0.mockReturnValue({
      user: { name: "Alice", email: "alice@example.com" },
    });
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    const { container } = render(<ProfilePage />);
    expect(container.querySelector("dd")?.textContent).toContain("Alice");
    expect(container.textContent).toContain("alice@example.com");
    expect(container.textContent).toContain("Member");
    expect(container.textContent).toContain("You can view products and manage your profile.");
    expect(container.textContent).toContain("Products and Assembly Guides");
    expect(container.textContent).toContain("Profile Management");
    expect(container.textContent).not.toContain("Finance and Operations (read)");
    expect(container.textContent).not.toContain("Finance and Operations (write)");
  });

  it("renders owner profile with finance read and write access", () => {
    mockUseAuth0.mockReturnValue({
      user: { name: "Chuck", email: "chuck@example.com" },
    });
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    const { container } = render(<ProfilePage />);
    expect(container.textContent).toContain("Owner");
    expect(container.textContent).toContain("Finance and Operations (read)");
    expect(container.textContent).toContain("Finance and Operations (write)");
  });

  it("renders auditor profile with finance read but not write", () => {
    mockUseAuth0.mockReturnValue({
      user: { name: "Audrey", email: "audrey@example.com" },
    });
    mockUseRole.mockReturnValue({ role: "auditor", isLoaded: true });
    const { container } = render(<ProfilePage />);
    expect(container.textContent).toContain("Auditor");
    expect(container.textContent).toContain("Finance and Operations (read)");
    expect(container.textContent).not.toContain("Finance and Operations (write)");
  });

  it("renders fallback dashes when name and email are missing", () => {
    mockUseAuth0.mockReturnValue({ user: {} });
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    const { container } = render(<ProfilePage />);
    const dashes = container.querySelectorAll("dd");
    const dashTexts = Array.from(dashes).filter((dd) => dd.textContent === "\u2014");
    expect(dashTexts).toHaveLength(2);
  });

  it("renders anonymous role info", () => {
    mockUseAuth0.mockReturnValue({ user: { name: "Ghost" } });
    mockUseRole.mockReturnValue({ role: "anonymous", isLoaded: true });
    const { container } = render(<ProfilePage />);
    expect(container.textContent).toContain("Anonymous");
  });

  it("renders breadcrumb navigation and heading", () => {
    mockUseAuth0.mockReturnValue({ user: { name: "Test" } });
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    const { container } = render(<ProfilePage />);
    expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    expect(container.querySelector("h1")?.textContent).toBe("Profile");
  });
});
