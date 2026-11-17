import { useState } from "react";

import { describeClient } from "@trestle/auth/client";
import { changePasswordSchema } from "@trestle/api-client/schemas";
import { useChangePassword, useRevokeOtherSessions, useRevokeSession, useSessions } from "@trestle/api-client/react";
import type { SessionInfo } from "@trestle/api-client/types";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { PageHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/format";
import { translate } from "@/lib/validation";

function ChangePasswordForm() {
  const change = useChangePassword();
  const [done, setDone] = useState(false);
  const form = useZodForm(changePasswordSchema, { defaultValues: { currentPassword: "", newPassword: "" } });

  const onSubmit = submitForm(form, async (values) => {
    await change.mutateAsync(values);
    form.reset();
    setDone(true);
  });

  const formError = rootError(form, translate);

  return (
    <form className="flex max-w-sm flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}
      {done ? (
        <p role="status" className="text-sm text-text-secondary">
          Password updated. Your other devices were signed out.
        </p>
      ) : null}

      <Field label="Current password" error={fieldError(form, "currentPassword", translate)}>
        {(control) => <Input type="password" autoComplete="current-password" {...control} {...form.register("currentPassword", { onChange: () => setDone(false) })} />}
      </Field>
      <Field label="New password" error={fieldError(form, "newPassword", translate)}>
        {(control) => <Input type="password" autoComplete="new-password" {...control} {...form.register("newPassword", { onChange: () => setDone(false) })} />}
      </Field>

      <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

function SessionRow({ session }: { session: SessionInfo }) {
  const revoke = useRevokeSession();
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {describeClient(session.userAgent)}
          {session.current ? <span className="ms-2 rounded-full bg-background-subtle px-2 py-0.5 text-xs font-normal text-text-secondary">This device</span> : null}
        </p>
        <p className="text-xs text-text-secondary">Last active {formatRelative(session.lastUsedAt)}</p>
      </div>
      {session.current ? null : (
        <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(session.id)}>
          Sign out
        </Button>
      )}
    </li>
  );
}

function Sessions() {
  const sessions = useSessions();
  const revokeOthers = useRevokeOtherSessions();

  if (sessions.isPending) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (sessions.isError) return <FormError>Could not load your sessions.</FormError>;

  const hasOthers = sessions.data.some((s) => !s.current);
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <ul className="divide-y divide-border">
        {sessions.data.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </ul>
      {hasOthers ? (
        <Button variant="outline" className="self-start" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
          Sign out all other devices
        </Button>
      ) : null}
    </div>
  );
}

export function AccountPage() {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-auto">
      <PageHeader crumb="Account" title="Account and security" />
      <div className="flex flex-col gap-8 p-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Password</h2>
          <ChangePasswordForm />
        </section>
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Where you are signed in</h2>
            <p className="text-sm text-text-secondary">Sign out any device you do not recognise.</p>
          </div>
          <Sessions />
        </section>
      </div>
    </div>
  );
}
