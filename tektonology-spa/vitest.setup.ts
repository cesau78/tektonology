import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

//silence React's "incorrect casing" warning since it doesn't apply to our mocked components
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === "string" && args[0].includes("incorrect casing")) return;
  originalError(...args);
};

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "mock-geist-sans" }),
  Geist_Mono: () => ({ variable: "mock-geist-mono" }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...rest }, children),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock globals.css import
vi.mock("./app/globals.css", () => ({}));
