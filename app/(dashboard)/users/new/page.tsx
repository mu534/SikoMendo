import { requirePermission } from "@/lib/session";
import { CreateUserForm } from "@/features/users/create-user-form";

export default async function NewUserPage() {
  await requirePermission("MANAGE_USERS");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-900">New user account</h2>
        <p className="mt-1 text-sm text-ink-900/60">Provision access for a staff member. They'll sign in with this email and password.</p>
      </div>
      <CreateUserForm />
    </div>
  );
}
