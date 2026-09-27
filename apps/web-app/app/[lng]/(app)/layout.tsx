export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen bg-background text-text-primary">{children}</div>;
}
