// Root layout — minimal shell required by Next.js.
// The <html> lang attribute, <body> classes, and providers are all set by
// app/[lang]/layout.tsx after the locale is resolved from the route segment.
// This wrapper just satisfies the framework's root-layout requirement.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
