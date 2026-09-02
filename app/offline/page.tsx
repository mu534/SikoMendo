import { WifiOff } from "lucide-react";
import { ReloadButton } from "./reload-button";

export const metadata = {
  title: "You're offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sand-50 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <WifiOff className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-semibold text-ink-900">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-900/60">
        Siko Mendo HRMIS needs an internet connection to load your data — employee records, leave
        requests, and cooperative information all stay live on the server so what you see is always
        current. Once you&apos;re back online, try again.
      </p>
      <ReloadButton />
    </div>
  );
}
