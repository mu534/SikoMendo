import { getUserById } from "@/features/users/queries";
import EditUserForm from "./EditUserForm";
import { getSessionFromRequest } from "@/lib/auth";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const session = await getSessionFromRequest();
  if (!session) {
    return (
      <html>
        <body>
          <script dangerouslySetInnerHTML={{ __html: "window.location.href='/sign-in'" }} />
        </body>
      </html>
    );
  }

  const user = await getUserById(params.id);
  if (!user) {
    return <div className="p-8">User not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Edit User</h2>
        <p className="mt-1 text-sm text-zinc-600">Update user details and role.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-8">
        {/* @ts-expect-error Server -> Client prop serialization */}
        <EditUserForm id={user.id} initialName={user.name} initialEmail={user.email} initialRole={user.role} initialBanned={user.banned} />
      </div>
    </div>
  );
}
