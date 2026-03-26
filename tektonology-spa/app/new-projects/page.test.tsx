import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
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

import NewProjectsPage from "./page";

const sampleProjects = [
  {
    projectId: 1,
    name: "Pew Restoration Phase 1",
    client: "St. Mary's",
    proBono: false,
    effective: "2025-03-01",
    status: "active",
    items: [
      { inventoryId: 10, product: "Upper Boot", quantity: 4 },
      { inventoryId: 11, product: "Floor Pad", quantity: 2 },
    ],
  },
  {
    projectId: 2,
    name: "Community Center Repair",
    proBono: true,
    effective: "2025-04-15",
    status: "completed",
    items: [],
  },
  {
    projectId: 3,
    name: "Cancelled Project",
    client: "Test Client",
    proBono: false,
    effective: "2025-01-01",
    status: "cancelled",
    items: [{ inventoryId: 12, product: "Widget", quantity: 1 }],
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

describe("NewProjectsPage", () => {
  it("shows loading state while fetching", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<NewProjectsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("renders projects after loading", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Community Center Repair")).toBeInTheDocument();
    expect(screen.getByText("St. Mary's —")).toBeInTheDocument();
  });

  it("renders page heading and description", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Projects")).toBeInTheDocument();
    });
    expect(screen.getByText("Church restoration projects — track pew maps, hardware, and installation progress.")).toBeInTheDocument();
  });

  it("shows pro bono label", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pro Bono —")).toBeInTheDocument();
    });
  });

  it("shows status badges", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("active")).toBeInTheDocument();
    });
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("shows item count for projects with items", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("2 line items (6 total units)")).toBeInTheDocument();
    });
  });

  it("hides deleted projects by default", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Cancelled Project")).not.toBeInTheDocument();
  });

  it("shows deleted projects when Show Deleted is clicked", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Cancelled Project")).toBeInTheDocument();
    });
    expect(screen.getByText("Hide Deleted")).toBeInTheDocument();
  });

  it("shows Add Project button for writable role", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
  });

  it("hides Add Project button for non-writable role", async () => {
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("+ Add Project")).not.toBeInTheDocument();
  });

  it("opens add form and validates empty name", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    expect(screen.getByPlaceholderText("Project Name")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("successfully adds a project", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    fireEvent.change(screen.getByPlaceholderText("Project Name"), { target: { value: "New Project" } });
    fireEvent.change(screen.getByPlaceholderText("Client (optional)"), { target: { value: "Test Client" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce([]);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.queryByPlaceholderText("Project Name")).not.toBeInTheDocument();
  });

  it("shows action error when add fails", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    fireEvent.change(screen.getByPlaceholderText("Project Name"), { target: { value: "Fail" } });
    mockApiFetch.mockRejectedValueOnce(new Error("Create failed"));
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Create failed")).toBeInTheDocument();
  });

  it("shows action error when add fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    fireEvent.change(screen.getByPlaceholderText("Project Name"), { target: { value: "Fail" } });
    mockApiFetch.mockRejectedValueOnce("string error");
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Failed to add")).toBeInTheDocument();
  });

  it("cancels add form", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    expect(screen.getByPlaceholderText("Project Name")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Cancel"));
    });
    expect(screen.queryByPlaceholderText("Project Name")).not.toBeInTheDocument();
  });

  it("changes pro bono checkbox in add form", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("changes status select in add form", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Project"));
    });
    const select = screen.getByDisplayValue("Active");
    fireEvent.change(select, { target: { value: "completed" } });
    expect(select).toHaveValue("completed");
  });

  it("deletes a project", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleProjects);
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/projects/1", { method: "DELETE" });
  });

  it("shows action error when delete fails", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce(new Error("Delete failed"));
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(screen.getByText("Delete failed")).toBeInTheDocument();
  });

  it("shows action error when delete fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce("oops");
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(screen.getByText("Failed to delete")).toBeInTheDocument();
  });

  it("restores a deleted project", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Cancelled Project")).toBeInTheDocument();
    });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleProjects);
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/projects/3/restore", { method: "POST" });
  });

  it("shows action error when restore fails", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Cancelled Project")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce(new Error("Restore failed"));
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(screen.getByText("Restore failed")).toBeInTheDocument();
  });

  it("shows action error when restore fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Cancelled Project")).toBeInTheDocument();
    });
    mockApiFetch.mockRejectedValueOnce("oops");
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(screen.getByText("Failed to restore")).toBeInTheDocument();
  });

  it("enters edit mode and saves changes", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    // Should show edit fields
    const nameInput = screen.getByDisplayValue("Pew Restoration Phase 1");
    expect(nameInput).toBeInTheDocument();
    const clientInput = screen.getByDisplayValue("St. Mary's");
    expect(clientInput).toBeInTheDocument();
    // Change values
    fireEvent.change(nameInput, { target: { value: "Updated Name" } });
    fireEvent.change(clientInput, { target: { value: "New Client" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleProjects);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/projects/1", expect.objectContaining({ method: "PUT" }));
  });

  it("shows action error when edit save fails", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    mockApiFetch.mockRejectedValueOnce(new Error("Save failed"));
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });

  it("shows action error when edit save fails with non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    mockApiFetch.mockRejectedValueOnce("oops");
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Failed to save")).toBeInTheDocument();
  });

  it("cancels edit mode", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    expect(screen.getByDisplayValue("Pew Restoration Phase 1")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Cancel"));
    });
    // Should be back to display mode
    expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Pew Restoration Phase 1")).not.toBeInTheDocument();
  });

  it("changes edit status and pro bono in edit mode", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    const select = screen.getByDisplayValue("Active");
    fireEvent.change(select, { target: { value: "completed" } });
    expect(select).toHaveValue("completed");
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("hides edit/delete buttons for non-writable role", async () => {
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("edits a project without a client (client ?? '' branch)", async () => {
    // Community Center Repair has no client field
    mockApiFetch.mockResolvedValue([sampleProjects[1]]);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Community Center Repair")).toBeInTheDocument();
    });
    const editButton = screen.getByText("Edit");
    await act(async () => {
      fireEvent.click(editButton);
    });
    // client defaults to "" when undefined
    const clientInput = screen.getByPlaceholderText("Client");
    expect(clientInput).toHaveValue("");
  });

  it("saves edit with empty client (client.trim() || undefined branch)", async () => {
    mockApiFetch.mockResolvedValue(sampleProjects);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Pew Restoration Phase 1")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    const clientInput = screen.getByDisplayValue("St. Mary's");
    fireEvent.change(clientInput, { target: { value: "" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleProjects);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    // Verify the PUT was called with client: undefined
    const putCall = mockApiFetch.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/api/projects/1") && (c[1] as Record<string, string>)?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as Record<string, string>).body);
    expect(body.client).toBeUndefined();
  });

  it("renders unknown status with default styling", async () => {
    const projectsWithUnknownStatus = [
      { ...sampleProjects[0], status: "unknown_status" },
    ];
    mockApiFetch.mockResolvedValue(projectsWithUnknownStatus);
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("unknown_status")).toBeInTheDocument();
    });
  });

  it("does not show item count when totalItems is 0", async () => {
    mockApiFetch.mockResolvedValue([sampleProjects[1]]); // Community Center Repair has empty items
    render(<NewProjectsPage />);
    await waitFor(() => {
      expect(screen.getByText("Community Center Repair")).toBeInTheDocument();
    });
    expect(screen.queryByText(/line items/)).not.toBeInTheDocument();
  });
});
