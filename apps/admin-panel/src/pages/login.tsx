import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@trestle/api-client";
import { loginSchema } from "@trestle/api-client/schemas";
import { useLogin } from "@trestle/api-client/react";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";
import { Logo } from "@trestle/ui/components/logo";

import { api } from "@/lib/api";
import { startSession, useSession } from "@/lib/session";
import { translate } from "@/lib/validation";

// Only these roles may use the panel, so anyone else is turned away here rather than shown empty tables.
const ADMIN_ROLES = ["owner", "admin"];

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const form = useZodForm(loginSchema, { defaultValues: { email: "", password: "" } });

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = submitForm(form, async (values) => {
    const { user } = await login.mutateAsync(values);
    if (!ADMIN_ROLES.includes(user.role)) {
      // The API has already opened a session for them; end it rather than leave a cookie behind.
      await api.auth.logout().catch(() => undefined);
      throw new ApiError("You don't have access to the admin panel.", "forbidden", 403);
    }
    startSession(user);
    navigate(from ?? "/", { replace: true });
  });

  if (session.status === "signed-in") return <Navigate to="/" replace />;

  const formError = rootError(form, translate);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-subtle px-4">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-border bg-background p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Logo wordmark={false} size="lg" />
          <div className="text-center">
            <h1 className="text-xl leading-heading font-bold">Trestle Admin</h1>
            <p className="mt-1 text-sm text-text-secondary">Sign in with your admin account.</p>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Email" error={fieldError(form, "email", translate)}>
            {(control) => (
              <Input type="email" autoComplete="email" placeholder="you@company.com" {...control} {...form.register("email")} />
            )}
          </Field>

          <Field label="Password" error={fieldError(form, "password", translate)}>
            {(control) => (
              <Input type="password" autoComplete="current-password" {...control} {...form.register("password")} />
            )}
          </Field>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
