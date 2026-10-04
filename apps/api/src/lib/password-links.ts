import { eq } from "drizzle-orm";

import type { Deps } from "../context";
import { schema } from "../db";
import { newToken } from "./password";

const HOUR = 3_600_000;

/**
 * Emails a one-time link to set a password: a reset link (valid 1 hour) for an existing account, or an
 * invitation (valid 7 days). Any earlier link for the same account stops working.
 */
export async function sendPasswordLink(
  { db, mailer, config }: Pick<Deps, "db" | "mailer" | "config">,
  user: { id: string; name: string; email: string },
  kind: "reset" | "invite",
) {
  const { token, hash } = newToken();
  await db.transaction(async (tx) => {
    await tx.delete(schema.passwordResets).where(eq(schema.passwordResets.userId, user.id));
    await tx.insert(schema.passwordResets).values({
      tokenHash: hash,
      userId: user.id,
      expiresAt: new Date(Date.now() + (kind === "reset" ? HOUR : 168 * HOUR)),
    });
  });

  const link = `${config.WEB_APP_URL}/en/reset-password?token=${token}`;
  await mailer.send(
    kind === "reset"
      ? { to: user.email, subject: "Reset your Trestle password", text: `Hi ${user.name},\n\nSet a new password here (valid for 1 hour):\n${link}\n` }
      : { to: user.email, subject: "You have been invited to Trestle", text: `Hi ${user.name},\n\nAccept your invitation and choose a password (valid for 7 days):\n${link}\n` },
  );
}
