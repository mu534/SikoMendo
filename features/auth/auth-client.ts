export async function signOut() {
  await fetch("/api/auth/sign-out", { method: "POST" });
  // client-side redirect
  window.location.href = "/sign-in";
}
