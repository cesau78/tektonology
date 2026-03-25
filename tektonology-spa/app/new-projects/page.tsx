"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { RequireRole } from "@/components/auth-guard";
import { useApiFetch } from "@/lib/api";
import { useRole, canWrite } from "@/lib/auth";

interface ProjectItemData {
  inventoryId: number;
  product: string;
  quantity: number;
}

interface ProjectData {
  projectId: number;
  name: string;
  client?: string;
  proBono: boolean;
  effective: string;
  status: string;
  items: ProjectItemData[];
  journalId?: number;
  deletedAt?: string;
}

export default function NewProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", client: "", proBono: false, status: "active" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ name: "", client: "", status: "active", proBono: false });
  const { role } = useRole();
  const apiFetch = useApiFetch();
  const writable = canWrite(role);

  const load = useCallback(() => {
    apiFetch<ProjectData[]>(`/api/projects${showDeleted ? "?includeDeleted=true" : ""}`)
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, [apiFetch, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setActionError(null);
    if (!newProject.name.trim()) { setActionError("Name is required"); return; }
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProject,
          name: newProject.name.trim(),
          client: newProject.client.trim() || undefined,
          effective: new Date().toISOString().slice(0, 10),
          items: [],
        }),
      });
      setAdding(false);
      setNewProject({ name: "", client: "", proBono: false, status: "active" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const saveEdit = async (projectId: number) => {
    setActionError(null);
    try {
      await apiFetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editValues.name.trim(),
          client: editValues.client.trim() || undefined,
          status: editValues.status,
          proBono: editValues.proBono,
        }),
      });
      setEditingId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDelete = async (projectId: number) => {
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleRestore = async (projectId: number) => {
    try {
      await apiFetch(`/api/projects/${projectId}/restore`, { method: "POST" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-900 border-green-300",
    completed: "bg-blue-100 text-blue-900 border-blue-300",
    cancelled: "bg-gray-100 text-gray-900 border-gray-300",
  };

  const visible = showDeleted ? projects : projects?.filter((p) => !p.deletedAt);

  return (
    <RequireRole roles={["owner"]}>
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Church restoration projects — track pew maps, hardware, and installation progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDeleted((v) => !v)} className={showDeleted ? "border-gray-400" : ""}>
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
          {writable && !adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add Project</Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!projects && !error && <LoadingState />}

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>
      )}

      {adding && (
        <Card className="shadow-sm border-dashed mb-6">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">New Project</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="text" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="Project Name" className="border border-border rounded px-2 py-1 text-sm bg-background" autoFocus />
              <input type="text" value={newProject.client} onChange={(e) => setNewProject({ ...newProject, client: e.target.value })} placeholder="Client (optional)" className="border border-border rounded px-2 py-1 text-sm bg-background" />
              <select value={newProject.status} onChange={(e) => setNewProject({ ...newProject, status: e.target.value })} className="border border-border rounded px-2 py-1 text-sm bg-background">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newProject.proBono} onChange={(e) => setNewProject({ ...newProject, proBono: e.target.checked })} />
                Pro Bono
              </label>
            </div>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="xs" onClick={handleAdd}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => { setAdding(false); setActionError(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {visible && (
        <div className="grid gap-3">
          {visible.map((project) => {
            const deleted = !!project.deletedAt;
            const editing = editingId === project.projectId;
            const totalItems = project.items.reduce((s, i) => s + i.quantity, 0);

            return (
              <Card key={project.projectId} className={`bg-card shadow-sm ${deleted ? "opacity-50" : ""}`}>
                <CardHeader>
                  {editing ? (
                    <div className="space-y-2">
                      <input type="text" value={editValues.name} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} className="w-full border border-border rounded px-2 py-1 text-sm bg-background font-medium" autoFocus />
                      <input type="text" value={editValues.client} onChange={(e) => setEditValues({ ...editValues, client: e.target.value })} placeholder="Client" className="w-full border border-border rounded px-2 py-1 text-sm bg-background" />
                      <div className="flex gap-2 items-center">
                        <select value={editValues.status} onChange={(e) => setEditValues({ ...editValues, status: e.target.value })} className="border border-border rounded px-2 py-1 text-sm bg-background">
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <label className="flex items-center gap-1 text-sm">
                          <input type="checkbox" checked={editValues.proBono} onChange={(e) => setEditValues({ ...editValues, proBono: e.target.checked })} />
                          Pro Bono
                        </label>
                        <div className="flex-1" />
                        <Button variant="ghost" size="xs" onClick={() => saveEdit(project.projectId)}>Save</Button>
                        <Button variant="ghost" size="xs" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{project.name}</CardTitle>
                        <CardDescription>
                          {project.client && <span>{project.client} — </span>}
                          {project.proBono && <span className="text-amber-600">Pro Bono — </span>}
                          <span>{project.effective}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[project.status] ?? "bg-gray-100"}>
                          {project.status}
                        </Badge>
                        {writable && !deleted && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="xs" onClick={() => {
                              setEditingId(project.projectId);
                              setEditValues({ name: project.name, client: project.client ?? "", status: project.status, proBono: project.proBono });
                            }}>Edit</Button>
                            <Button variant="ghost" size="xs" className="text-red-600" onClick={() => handleDelete(project.projectId)}>Delete</Button>
                          </div>
                        )}
                        {writable && deleted && (
                          <Button variant="ghost" size="xs" onClick={() => handleRestore(project.projectId)}>Restore</Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardHeader>
                {!editing && totalItems > 0 && (
                  <CardContent>
                    <div className="text-xs text-muted-foreground">
                      {project.items.length} line items ({totalItems} total units)
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
    </RequireRole>
  );
}
