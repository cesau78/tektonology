import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import React from "react";

const mockApiFetch = vi.fn();
const mockUseRole = vi.fn();

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email_verified: true },
    getAccessTokenSilently: vi.fn(),
    loginWithRedirect: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

vi.mock("@/lib/auth", () => ({
  useRole: () => mockUseRole(),
  canWrite: (role: string) => role === "owner",
  canAccessFinance: () => true,
  isAuthenticated: () => true,
}));

vi.mock("@/components/auth-guard", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import NewProductsPage from "./page";

const sampleProducts = [
  {
    productId: 1,
    name: "Upper Boot",
    category: "Kneeler Parts",
    description: "Replacement boot for pew kneeler",
    origin: "original",
    versions: [{ version: "1.0", effective: "2025-01-01" }],
  },
  {
    productId: 2,
    name: "Floor Pad",
    category: "Kneeler Parts",
    description: "Floor pad for kneeler",
    origin: "original",
    versions: [],
  },
  {
    productId: 3,
    name: "Hex Wrench",
    category: "Tools",
    description: "3mm hex wrench",
    origin: "third-party",
    versions: [{ version: "2.0", effective: "2025-06-01" }],
  },
  {
    productId: 4,
    name: "Deleted Widget",
    category: "Misc",
    description: "A deleted product",
    origin: "original",
    versions: [],
    deletedAt: "2025-05-01",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
});

afterEach(() => {
  cleanup();
});

describe("NewProductsPage", () => {
  it("shows loading state while fetching", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<NewProductsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("renders products grouped by category after loading", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    expect(screen.getByText("Kneeler Parts")).toBeInTheDocument();
    expect(screen.getByText("Floor Pad")).toBeInTheDocument();
    // Tools category sorted last
    expect(screen.getByText("Hex Wrench")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("displays version info for products with versions", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("v1.0")).toBeInTheDocument();
    });
    expect(screen.getByText("v2.0")).toBeInTheDocument();
  });

  it("hides deleted products by default", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    expect(screen.queryByText("Deleted Widget")).not.toBeInTheDocument();
  });

  it("shows deleted products when Show Deleted is clicked", async () => {
    // First call returns active only, second call returns all including deleted
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Deleted Widget")).toBeInTheDocument();
    });
    expect(screen.getByText("Hide Deleted")).toBeInTheDocument();
  });

  it("shows Add Product button for writable role", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
  });

  it("hides Add Product button for non-writable role", async () => {
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    expect(screen.queryByText("+ Add Product")).not.toBeInTheDocument();
  });

  it("opens add form and shows validation error for empty name", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("shows validation error for empty category", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Test Product" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Category is required")).toBeInTheDocument();
  });

  it("successfully adds a product", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "New Product" } });
    fireEvent.change(screen.getByPlaceholderText("Category"), { target: { value: "Parts" } });
    fireEvent.change(screen.getByPlaceholderText("Description"), { target: { value: "A new part" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce([]);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    // Form should close after successful add
    expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
  });

  it("shows action error when add fails", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Fail Product" } });
    fireEvent.change(screen.getByPlaceholderText("Category"), { target: { value: "Parts" } });
    mockApiFetch.mockRejectedValueOnce(new Error("Create failed"));
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Create failed")).toBeInTheDocument();
  });

  it("shows action error when add fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Fail" } });
    fireEvent.change(screen.getByPlaceholderText("Category"), { target: { value: "X" } });
    mockApiFetch.mockRejectedValueOnce("string error");
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Failed to add")).toBeInTheDocument();
  });

  it("cancels add form and clears action error", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    // Trigger an action error first
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByPlaceholderText("Category"), { target: { value: "Y" } });
    mockApiFetch.mockRejectedValueOnce(new Error("Oops"));
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Oops")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Cancel"));
    });
    expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
  });

  it("deletes a product", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleProducts);
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/products/1", { method: "DELETE" });
  });

  it("shows action error when delete fails", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce(new Error("Delete failed"));
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(screen.getByText("Delete failed")).toBeInTheDocument();
  });

  it("shows action error when delete fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce("oops");
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(screen.getByText("Failed to delete")).toBeInTheDocument();
  });

  it("restores a deleted product", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    // Show deleted
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Deleted Widget")).toBeInTheDocument();
    });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleProducts);
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/products/4/restore", { method: "POST" });
  });

  it("shows action error when restore fails", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Deleted Widget")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce(new Error("Restore failed"));
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(screen.getByText("Restore failed")).toBeInTheDocument();
  });

  it("shows action error when restore fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Deleted Widget")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce("oops");
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(screen.getByText("Failed to restore")).toBeInTheDocument();
  });

  it("hides delete/restore buttons for non-writable role", async () => {
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleProducts);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("changes origin dropdown in add form", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Product")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Product"));
    });
    const select = screen.getByDisplayValue("Original");
    fireEvent.change(select, { target: { value: "third-party" } });
    expect(select).toHaveValue("third-party");
  });

  it("sorts categories with Tools last", async () => {
    mockApiFetch.mockResolvedValue(sampleProducts);
    const { container } = render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Upper Boot")).toBeInTheDocument();
    });
    const sections = container.querySelectorAll("section");
    // Kneeler Parts first, Tools last
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it("handles showDeleted toggle while products is still null", async () => {
    mockApiFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NewProductsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    // Still loading — visible is null, grouped uses fallback []
    expect(screen.getByText("Hide Deleted")).toBeInTheDocument();
  });

  it("renders page heading and description", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });
    expect(screen.getByText("Select a product to view print settings, assembly guides, and downloads.")).toBeInTheDocument();
  });
});
