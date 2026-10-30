// Root layout — minimal shell. The html lang attribute and providers are set
// by app/[lang]/layout.tsx after the locale is resolved from the route segment.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
