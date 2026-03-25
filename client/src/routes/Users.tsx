import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { apiFetch } from "../auth/api";
import { getAccessToken } from "../auth/authStore";

type UserRow = {
  id: string;
  email: string;
  role: "user" | "admin" | "root";
  email_verified: boolean;
  last_ip: string | null;
};

type TokenClaims = {
  sub?: string;
  role?: "user" | "admin" | "root";
};

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<TokenClaims>({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const [, payload] = token.split(".");
    if (!payload) return;
    try {
      const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(b64)) as TokenClaims;
      setViewer(claims);
    } catch {
      setViewer({});
    }
  }, []);

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      setError("");

      try {
        const res = await apiFetch("/api/admin/users");
        const data: unknown = await res.json().catch(() => []);

        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data &&
            "error" in data &&
            typeof (data as { error?: unknown }).error === "string"
              ? (data as { error: string }).error
              : `Request failed (${res.status})`;
          setError(msg);
          return;
        }

        setUsers(Array.isArray(data) ? (data as UserRow[]) : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadUsers();
  }, []);

  async function deleteUser(user: UserRow) {
    const ok = window.confirm(
      `Delete user ${user.email}?\n\nThis will permanently remove the user and their weather history.`
    );
    if (!ok) return;

    setError("");
    setDeletingUserId(user.id);
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${res.status})`;
        setError(msg);
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-12">
        <div className="w-full">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Registered users</h1>
              <p className="mt-2 text-sm text-slate-300">Admin-only list of all accounts.</p>
            </div>
            <Link
              to="/home"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              Back to home
            </Link>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur sm:p-7">
            {isLoading ? <p className="text-slate-300">Loading users...</p> : null}
            {!isLoading && error ? <p className="text-red-300">{error}</p> : null}

            {!isLoading && !error ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-300">
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Verified</th>
                      <th className="px-3 py-2 font-medium">Last IP</th>
                      <th className="px-3 py-2 font-medium">User ID</th>
                      <th className="px-3 py-2 font-medium">Delete</th>
                      <th className="px-3 py-2 font-medium">View history</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const isSelf = user.id === viewer.sub;
                      const cannotDeleteRoot = user.role === "root" && viewer.role !== "root";
                      const disableDelete = isSelf || cannotDeleteRoot || deletingUserId === user.id;

                      return (
                      <tr key={user.id} className="border-b border-white/10">
                        <td className="px-3 py-2">{user.email}</td>
                        <td className="px-3 py-2 uppercase">{user.role}</td>
                        <td className="px-3 py-2">{user.email_verified ? "Yes" : "No"}</td>
                        <td className="px-3 py-2">{user.last_ip ?? "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{user.id}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => deleteUser(user)}
                            disabled={disableDelete}
                            title={isSelf ? "You cannot delete your own account." : cannotDeleteRoot ? "Only root can delete a root account." : ""}
                            className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingUserId === user.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                        {/* here */}
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/history?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email)}`, { state: { userId: user.id }} )}
                            className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            View History
                          </button>
                        </td>
  
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
