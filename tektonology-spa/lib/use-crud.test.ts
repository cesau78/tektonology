import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCrud } from "./use-crud";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue([]);
});

/** Helper: call an async action inside act, capture the thrown error, and wait for state to settle. */
async function actAndCatch(fn: () => Promise<unknown>): Promise<unknown> {
  let caught: unknown;
  await act(async () => {
    try {
      await fn();
    } catch (e) {
      caught = e;
    }
  });
  return caught;
}

describe("useCrud", () => {
  describe("load", () => {
    it("fetches items on mount", async () => {
      const items = [{ id: 1, name: "a" }];
      mockApiFetch.mockResolvedValue(items);

      const { result } = renderHook(() => useCrud("/things"));

      await waitFor(() => {
        expect(result.current.items).toEqual(items);
      });
      expect(mockApiFetch).toHaveBeenCalledWith("/things");
    });

    it("sets error when load fails", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network down"));

      const { result } = renderHook(() => useCrud("/things"));

      await waitFor(() => {
        expect(result.current.error).toBe("Network down");
      });
    });

    it("can be called manually to reload", async () => {
      mockApiFetch.mockResolvedValue([{ id: 1 }]);

      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      mockApiFetch.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await act(async () => {
        result.current.load();
      });

      await waitFor(() => {
        expect(result.current.items).toHaveLength(2);
      });
    });
  });

  describe("showDeleted", () => {
    it("appends includeDeleted query param when showDeleted is true", async () => {
      mockApiFetch.mockResolvedValue([]);

      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      expect(mockApiFetch).toHaveBeenCalledWith("/things");

      await act(async () => {
        result.current.setShowDeleted(true);
      });

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/things?includeDeleted=true",
        );
      });
    });
  });

  describe("create", () => {
    it("POSTs data and reloads on success", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch
        .mockResolvedValueOnce({ id: 1 }) // create
        .mockResolvedValueOnce([{ id: 1 }]); // reload
      await act(async () => {
        await result.current.create({ name: "new" });
      });

      expect(mockApiFetch).toHaveBeenCalledWith("/things", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "new" }),
      });
    });

    it("sets actionError and rethrows on Error failure", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      const err = new Error("Create failed");
      mockApiFetch.mockRejectedValueOnce(err);

      const caught = await actAndCatch(() =>
        result.current.create({ name: "bad" }),
      );

      expect(caught).toBe(err);
      expect(result.current.actionError).toBe("Create failed");
    });

    it("sets fallback actionError for non-Error thrown values", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch.mockRejectedValueOnce("string error");

      const caught = await actAndCatch(() =>
        result.current.create({ name: "bad" }),
      );

      expect(caught).toBe("string error");
      expect(result.current.actionError).toBe("Failed to create");
    });

    it("clears actionError before each attempt", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      // First: fail
      mockApiFetch.mockRejectedValueOnce(new Error("fail"));
      await actAndCatch(() => result.current.create({ name: "bad" }));
      expect(result.current.actionError).toBe("fail");

      // Second: succeed — actionError should be cleared
      mockApiFetch
        .mockResolvedValueOnce({}) // create
        .mockResolvedValueOnce([]); // reload
      await act(async () => {
        await result.current.create({ name: "good" });
      });
      expect(result.current.actionError).toBeNull();
    });
  });

  describe("update", () => {
    it("PUTs data and reloads on success", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch
        .mockResolvedValueOnce({}) // update
        .mockResolvedValueOnce([]); // reload
      await act(async () => {
        await result.current.update("42", { name: "updated" });
      });

      expect(mockApiFetch).toHaveBeenCalledWith("/things/42", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "updated" }),
      });
    });

    it("sets actionError and rethrows on Error failure", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      const err = new Error("Update failed");
      mockApiFetch.mockRejectedValueOnce(err);

      const caught = await actAndCatch(() =>
        result.current.update("42", { name: "bad" }),
      );

      expect(caught).toBe(err);
      expect(result.current.actionError).toBe("Update failed");
    });

    it("sets fallback actionError for non-Error thrown values", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch.mockRejectedValueOnce(42);

      const caught = await actAndCatch(() =>
        result.current.update("1", {}),
      );

      expect(caught).toBe(42);
      expect(result.current.actionError).toBe("Failed to update");
    });
  });

  describe("remove", () => {
    it("DELETEs and reloads on success", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch
        .mockResolvedValueOnce({}) // delete
        .mockResolvedValueOnce([]); // reload
      await act(async () => {
        await result.current.remove("42");
      });

      expect(mockApiFetch).toHaveBeenCalledWith("/things/42", {
        method: "DELETE",
      });
    });

    it("sets actionError and rethrows on Error failure", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      const err = new Error("Delete failed");
      mockApiFetch.mockRejectedValueOnce(err);

      const caught = await actAndCatch(() => result.current.remove("42"));

      expect(caught).toBe(err);
      expect(result.current.actionError).toBe("Delete failed");
    });

    it("sets fallback actionError for non-Error thrown values", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch.mockRejectedValueOnce(null);

      const caught = await actAndCatch(() => result.current.remove("1"));

      expect(caught).toBeNull();
      expect(result.current.actionError).toBe("Failed to delete");
    });
  });

  describe("restore", () => {
    it("POSTs restore and reloads on success", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch
        .mockResolvedValueOnce({}) // restore
        .mockResolvedValueOnce([]); // reload
      await act(async () => {
        await result.current.restore("42");
      });

      expect(mockApiFetch).toHaveBeenCalledWith("/things/42/restore", {
        method: "POST",
      });
    });

    it("sets actionError and rethrows on Error failure", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      const err = new Error("Restore failed");
      mockApiFetch.mockRejectedValueOnce(err);

      const caught = await actAndCatch(() => result.current.restore("42"));

      expect(caught).toBe(err);
      expect(result.current.actionError).toBe("Restore failed");
    });

    it("sets fallback actionError for non-Error thrown values", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch.mockRejectedValueOnce(undefined);

      const caught = await actAndCatch(() => result.current.restore("1"));

      expect(caught).toBeUndefined();
      expect(result.current.actionError).toBe("Failed to restore");
    });
  });

  describe("permanentDelete", () => {
    it("DELETEs permanent and reloads on success", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch
        .mockResolvedValueOnce({}) // permanentDelete
        .mockResolvedValueOnce([]); // reload
      await act(async () => {
        await result.current.permanentDelete("42");
      });

      expect(mockApiFetch).toHaveBeenCalledWith("/things/42/permanent", {
        method: "DELETE",
      });
    });

    it("sets actionError and rethrows on Error failure", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      const err = new Error("Perm delete failed");
      mockApiFetch.mockRejectedValueOnce(err);

      const caught = await actAndCatch(() =>
        result.current.permanentDelete("42"),
      );

      expect(caught).toBe(err);
      expect(result.current.actionError).toBe("Perm delete failed");
    });

    it("sets fallback actionError for non-Error thrown values", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      mockApiFetch.mockRejectedValueOnce(false);

      const caught = await actAndCatch(() =>
        result.current.permanentDelete("1"),
      );

      expect(caught).toBe(false);
      expect(result.current.actionError).toBe(
        "Failed to permanently delete",
      );
    });
  });

  describe("setActionError", () => {
    it("allows manually setting and clearing actionError", async () => {
      const { result } = renderHook(() => useCrud("/things"));
      await waitFor(() => expect(result.current.items).toEqual([]));

      act(() => {
        result.current.setActionError("manual error");
      });
      expect(result.current.actionError).toBe("manual error");

      act(() => {
        result.current.setActionError(null);
      });
      expect(result.current.actionError).toBeNull();
    });
  });
});
