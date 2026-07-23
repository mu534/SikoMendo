import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getUserById } from "@/features/users/queries";
import { roleLabel } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EditUserForm } from "./EditUserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("MANAGE_USERS");
  const { id } = await params;

  const user = await getUserById(id);
  if (!user) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} imageUrl={user.image} size="lg" />
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">{user.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="brand">{roleLabel(user.role)}</Badge>
            {user.banned ? <Badge tone="danger">Banned</Badge> : <Badge tone="success">Active</Badge>}
            <span className="text-xs text-ink-900/50">Joined {formatDate(user.createdAt)}</span>
          </div>
          {user.username && (
            <p className="mt-1 text-sm text-ink-900/50">@{user.username}</p>
          )}
        </div>
      </div>

      <Card className="p-6">
        <EditUserForm
          user={{ id: user.id, name: user.name, username: user.username, role: user.role }}
        />
      </Card>
    </div>
  );
}
