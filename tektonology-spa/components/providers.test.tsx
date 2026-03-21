import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";

vi.mock("@auth0/auth0-react");
import { Auth0Provider } from "@auth0/auth0-react";
import { Providers } from "./providers";

let capturedOnRedirectCallback:
  | ((appState?: { returnTo?: string }) => void)
  | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnRedirectCallback = undefined;

  vi.mocked(Auth0Provider).mockImplementation(
    ({ children, onRedirectCallback }: any) => {
      capturedOnRedirectCallback = onRedirectCallback;
      return <div data-testid="auth0-provider">{children}</div>;
    },
  );
});

afterEach(cleanup);

describe("Providers", () => {
  it("renders children inside Auth0Provider", () => {
    const { container } = render(
      <Providers>
        <div>child content</div>
      </Providers>,
    );
    expect(container.querySelector("[data-testid='auth0-provider']")).toBeTruthy();
    expect(container.textContent).toContain("child content");
  });

  it("passes correct props to Auth0Provider", () => {
    render(
      <Providers>
        <div>child</div>
      </Providers>,
    );

    const calls = vi.mocked(Auth0Provider).mock.calls;
    expect(calls.length).toBe(1);
    const props = calls[0][0] as Record<string, unknown>;
    expect(props.cacheLocation).toBe("localstorage");
    expect(props.useRefreshTokens).toBe(true);
  });

  it("uses empty redirect_uri when window is unavailable (SSR)", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error — simulate SSR by removing window
    delete globalThis.window;
    try {
      renderToString(
        React.createElement(Providers, null, React.createElement("div", null, "child")),
      );
      const props = vi.mocked(Auth0Provider).mock.calls[0][0] as Record<string, any>;
      expect(props.authorizationParams.redirect_uri).toBe("");
    } finally {
      globalThis.window = origWindow;
    }
  });

  describe("onRedirectCallback", () => {
    it("replaces history state with returnTo when appState has returnTo", () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      render(
        <Providers>
          <div>child</div>
        </Providers>,
      );
      expect(capturedOnRedirectCallback).toBeDefined();
      capturedOnRedirectCallback!({ returnTo: "/dashboard" });
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        document.title,
        "/dashboard",
      );
      replaceStateSpy.mockRestore();
    });

    it("replaces history state with pathname when appState is undefined", () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      render(
        <Providers>
          <div>child</div>
        </Providers>,
      );
      capturedOnRedirectCallback!(undefined);
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        document.title,
        window.location.pathname,
      );
      replaceStateSpy.mockRestore();
    });

    it("replaces history state with pathname when appState has no returnTo", () => {
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      render(
        <Providers>
          <div>child</div>
        </Providers>,
      );
      capturedOnRedirectCallback!({});
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        document.title,
        window.location.pathname,
      );
      replaceStateSpy.mockRestore();
    });
  });
});
