import { getAllUsers } from "@/features/users/queries";
import { getSessionFromRequest } from "@/lib/auth";
import { can } from "@/lib/permissions";
import Link from "next/link";

export default async function UsersPage() {
  const session = await getSessionFromRequest();
  const { users, total } = await getAllUsers();

  const canManageUsers = session?.user && can(session.user.role, "MANAGE_USERS");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900">Users</h2>
          <p className="mt-1 text-sm text-zinc-600">Manage system users and their roles.</p>
        </div>
        {canManageUsers && (
          <Link
            href="/users/new"
            className="inline-flex items-center rounded-lg bg-sky-950 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            + Create User
          </Link>
        )}
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900">Role</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900">Status</th>
              {canManageUsers && (
                <th className="px-6 py-3 text-left text-sm font-semibold text-zinc-900">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 text-sm text-zinc-900">{user.name}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={user.banned ? "text-red-600" : "text-green-600"}>
                    {user.banned ? "Banned" : "Active"}
                  </span>
                </td>
                {canManageUsers && (
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/users/${user.id}`}
                      className="text-sky-600 hover:text-sky-800 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-600">Total users: {total}</p>
    </div>
  );
}
