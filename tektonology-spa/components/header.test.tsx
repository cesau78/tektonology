import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@auth0/auth0-react");
vi.mock("@/lib/auth");
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useAuth0 } from "@auth0/auth0-react";
import { useRole, canAccessFinance } from "@/lib/auth";
import { Header } from "./header";

const mockLoginWithRedirect = vi.fn();
const mockLogout = vi.fn();

function setAuth0(overrides: Record<string, unknown>) {
  vi.mocked(useAuth0).mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    user: undefined,
    loginWithRedirect: mockLoginWithRedirect,
    logout: mockLogout,
    getAccessTokenSilently: vi.fn(),
    getAccessTokenWithPopup: vi.fn(),
    getIdTokenClaims: vi.fn(),
    loginWithPopup: vi.fn(),
    handleRedirectCallback: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth0>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRole).mockReturnValue({ role: "anonymous", isLoaded: true });
  vi.mocked(canAccessFinance).mockReturnValue(false);
});

afterEach(() => {
  cleanup();
});

describe("Header", () => {
  it("renders the Tektonology link", () => {
    setAuth0({});
    render(<Header />);
    expect(screen.getByText("Tektonology")).toBeInTheDocument();
    expect(screen.getByText("Tektonology").closest("a")).toHaveAttribute("href", "/");
  });

  it("renders Projects and Products links in the nav bar", () => {
    setAuth0({});
    render(<Header />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("Projects").closest("a")).toHaveAttribute("href", "/projects");
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Products").closest("a")).toHaveAttribute("href", "/products");
  });

  it("shows sign in icon button when not loading and not authenticated", () => {
    setAuth0({ isLoading: false, isAuthenticated: false });
    render(<Header />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("calls loginWithRedirect when sign in is clicked", () => {
    setAuth0({ isLoading: false, isAuthenticated: false });
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mockLoginWithRedirect).toHaveBeenCalled();
  });

  it("shows profile icon link and sign out icon button when authenticated", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: true } });
    render(<Header />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("calls logout when sign out is clicked", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: true } });
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mockLogout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });

  it("hides sign in, profile, and sign out while loading", () => {
    setAuth0({ isLoading: true });
    render(<Header />);
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  });

  it("shows finance/procurement/manufacturing links for owner with verified email", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: true } });
    vi.mocked(useRole).mockReturnValue({ role: "owner", isLoaded: true });
    vi.mocked(canAccessFinance).mockReturnValue(true);
    render(<Header />);
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Finance").closest("a")).toHaveAttribute("href", "/finance");
    expect(screen.getByText("Procurement")).toBeInTheDocument();
    expect(screen.getByText("Procurement").closest("a")).toHaveAttribute("href", "/procurement");
    expect(screen.getByText("Manufacturing")).toBeInTheDocument();
    expect(screen.getByText("Manufacturing").closest("a")).toHaveAttribute("href", "/manufacturing");
  });

  it("shows email verification warning for owner with unverified email", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: false } });
    vi.mocked(useRole).mockReturnValue({ role: "owner", isLoaded: true });
    vi.mocked(canAccessFinance).mockReturnValue(true);
    render(<Header />);
    expect(screen.getByText("Verify Email to Access:")).toBeInTheDocument();
    expect(screen.getByText("Finance, Procurement & Manufacturing")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Procurement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manufacturing" })).not.toBeInTheDocument();
  });

  it("does not show finance links for member role", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: true } });
    vi.mocked(useRole).mockReturnValue({ role: "member", isLoaded: true });
    vi.mocked(canAccessFinance).mockReturnValue(false);
    render(<Header />);
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
    expect(screen.queryByText("Procurement")).not.toBeInTheDocument();
    expect(screen.queryByText("Manufacturing")).not.toBeInTheDocument();
    expect(screen.queryByText("Verify Email to Access:")).not.toBeInTheDocument();
  });

  it("does not show email verification warning when canAccessFinance is false even if email unverified", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: false } });
    vi.mocked(useRole).mockReturnValue({ role: "member", isLoaded: true });
    vi.mocked(canAccessFinance).mockReturnValue(false);
    render(<Header />);
    expect(screen.queryByText("Verify Email to Access:")).not.toBeInTheDocument();
  });

  it("shows finance links for auditor with verified email", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: true } });
    vi.mocked(useRole).mockReturnValue({ role: "auditor", isLoaded: true });
    vi.mocked(canAccessFinance).mockReturnValue(true);
    render(<Header />);
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Procurement")).toBeInTheDocument();
    expect(screen.getByText("Manufacturing")).toBeInTheDocument();
  });

  it("does not show finance links when user is undefined and canAccessFinance is true", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: undefined });
    vi.mocked(canAccessFinance).mockReturnValue(true);
    render(<Header />);
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
    expect(screen.queryByText("Verify Email to Access:")).not.toBeInTheDocument();
  });
});
