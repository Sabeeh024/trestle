import { Logo } from "@trestle/ui/components/logo";

// The centered card shared by the signed-out screens (sign in, sign up, forgot password).
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-subtle px-6">
      <div className="flex w-full max-w-100 flex-col gap-5 rounded-xl border border-border bg-background p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <Logo wordmark={false} size="lg" />
          <div className="text-center">
            <h1 className="text-2xl leading-heading font-bold">{title}</h1>
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
