"use client";

import { Auth0Provider, type AppState } from "@auth0/auth0-react";

const DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN!;
const CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!;
const AUDIENCE = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

function onRedirectCallback(appState?: AppState) {
  // Strip the auth callback params from the URL to prevent re-processing
  window.history.replaceState(
    {},
    document.title,
    appState?.returnTo ?? window.location.pathname,
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={DOMAIN}
      clientId={CLIENT_ID}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      onRedirectCallback={onRedirectCallback}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUDIENCE,
      }}
    >
      {children}
    </Auth0Provider>
  );
}
