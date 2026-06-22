"use client";

import { useState } from "react";

type Props = {
  id: string;
  initialName?: string | null;
  initialEmail?: string | null;
  initialRole?: string | null;
  initialBanned?: boolean | null;
};

export default function EditUserForm({ id, initialName, initialEmail, initialRole, initialBanned }: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [role, setRole] = useState(initialRole ?? "EMPLOYEE");
  const [banned, setBanned] = useState<boolean>(!!initialBanned);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, banned }),
      });

      const payload = await res.json();
      if (!res.ok && payload?.error) {
        setError(payload.error.message ?? "Failed to update user");
        return;
      }

      window.location.href = "/users";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this user? This action cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok && payload?.error) {
        setError(payload.error.message ?? "Failed to delete user");
        return;
      }
      window.location.href = "/users";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-900">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-2" />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-900">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 w-full rounded-lg border px-4 py-2">
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="HR_OFFICER">HR Officer</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={banned} onChange={(e) => setBanned(e.target.checked)} />
          <span className="text-sm text-zinc-700">Banned</span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="rounded-lg bg-sky-950 px-4 py-2 text-white">
          {loading ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={handleDelete} disabled={loading} className="rounded-lg border px-4 py-2">
          Delete
        </button>
      </div>
    </form>
  );
}
