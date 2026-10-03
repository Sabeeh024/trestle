import { Providers } from "@/app/providers";

// These screens read live API data on every request, so they must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen bg-background text-text-primary">{children}</div>
    </Providers>
  );
}
