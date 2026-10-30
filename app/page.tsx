import { redirect } from "next/navigation";

// The bare root `/` redirects to the default locale.
// proxy.ts handles locale detection for all other paths.
export default function RootPage() {
  redirect("/en");
}
