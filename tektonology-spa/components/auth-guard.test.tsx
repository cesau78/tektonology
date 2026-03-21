import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@auth0/auth0-react");
vi.mock("@/lib/auth");
import { render, cleanup, fireEvent, within } from "@testing-library/react";
import { useAuth0 } from "@auth0/auth0-react";
import { useRole } from "@/lib/auth";
import { RequireAuth, RequireRole } from "./auth-guard";

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

function setRole(role: string, isLoaded: boolean) {
  vi.mocked(useRole).mockReturnValue({ role: role as any, isLoaded });
}

beforeEach(() => {
  vi.clearAllMocks();
  setRole("anonymous", true);
});

afterEach(cleanup);

describe("RequireAuth", () => {
  it("shows loading state when isLoading is true", () => {
    setAuth0({ isLoading: true });
    const { container } = render(<RequireAuth><div>child</div></RequireAuth>);
    const view = within(container);
    expect(view.getByText("Loading…")).toBeInTheDocument();
    expect(view.queryByText("child")).not.toBeInTheDocument();
  });

  it("shows sign-in prompt when not authenticated", () => {
    setAuth0({ isAuthenticated: false });
    const { container } = render(<RequireAuth><div>child</div></RequireAuth>);
    const view = within(container);
    expect(view.getByText("Sign in required")).toBeInTheDocument();
    expect(view.getByText("You need to sign in to access this page.")).toBeInTheDocument();
    expect(view.queryByText("child")).not.toBeInTheDocument();
  });

  it("calls loginWithRedirect when sign in button is clicked", () => {
    setAuth0({ isAuthenticated: false });
    const { container } = render(<RequireAuth><div>child</div></RequireAuth>);
    const view = within(container);
    fireEvent.click(view.getByRole("button", { name: "Sign in" }));
    expect(mockLoginWithRedirect).toHaveBeenCalled();
  });

  it("renders children when authenticated", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: true } });
    const { container } = render(<RequireAuth><div>child</div></RequireAuth>);
    const view = within(container);
    expect(view.getByText("child")).toBeInTheDocument();
  });
});

describe("RequireRole", () => {
  it("shows loading state when auth0 isLoading is true", () => {
    setAuth0({ isLoading: true });
    setRole("anonymous", false);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows loading state when role is not loaded yet", () => {
    setAuth0({ isLoading: false, isAuthenticated: true, user: { email_verified: true } });
    setRole("anonymous", false);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows sign-in prompt when not authenticated", () => {
    setAuth0({ isAuthenticated: false });
    setRole("anonymous", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("Sign in required")).toBeInTheDocument();
  });

  it("calls loginWithRedirect when sign in button is clicked (RequireRole)", () => {
    setAuth0({ isAuthenticated: false });
    setRole("anonymous", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    fireEvent.click(view.getByRole("button", { name: "Sign in" }));
    expect(mockLoginWithRedirect).toHaveBeenCalled();
  });

  it("shows email verification required when email is not verified", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: false } });
    setRole("owner", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("Email verification required")).toBeInTheDocument();
    expect(
      view.getByText(
        "Please check your inbox and verify your email address to access this page.",
      ),
    ).toBeInTheDocument();
  });

  it("calls logout when sign out button is clicked on email verification screen", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: false } });
    setRole("owner", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    fireEvent.click(view.getByRole("button", { name: "Sign out" }));
    expect(mockLogout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });

  it("skips email verification check when user is null", () => {
    setAuth0({ isAuthenticated: true, user: null });
    setRole("member", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    // Falls through to role check since `user && !user.email_verified` is false
    expect(view.getByText("Access denied")).toBeInTheDocument();
  });

  it("shows access denied when role is not in allowed roles", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: true } });
    setRole("member", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("Access denied")).toBeInTheDocument();
    expect(
      view.getByText("Your role (member) does not have permission to view this page."),
    ).toBeInTheDocument();
  });

  it("renders children when role is authorized", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: true } });
    setRole("owner", true);
    const { container } = render(<RequireRole roles={["owner", "auditor"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("child")).toBeInTheDocument();
  });

  it("renders children for auditor role", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: true } });
    setRole("auditor", true);
    const { container } = render(<RequireRole roles={["owner", "auditor"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("child")).toBeInTheDocument();
  });

  it("shows email verified user with wrong role as access denied (not email prompt)", () => {
    setAuth0({ isAuthenticated: true, user: { email_verified: true } });
    setRole("anonymous", true);
    const { container } = render(<RequireRole roles={["owner"]}><div>child</div></RequireRole>);
    const view = within(container);
    expect(view.getByText("Access denied")).toBeInTheDocument();
  });
});
