import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

// Siko Mendo Union HRMIS is an internal system with no public marketing
// surface, so the root route just routes people to where they belong.
export default async function RootPage() {
  const session = await getServerSession();
  redirect(session ? "/dashboard" : "/sign-in");
}
