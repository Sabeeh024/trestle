"use client";

import { useParams, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { describeClient } from "@trestle/auth/client";
import { useRevokeOtherSessions, useRevokeSession } from "@trestle/api-client/react";
import type { SessionInfo } from "@trestle/api-client/types";
import { Button } from "@trestle/ui/components/ui/button";

import { formatRelative } from "@/lib/format";

export function SessionsList({ sessions }: { sessions: SessionInfo[] }) {
  const { t } = useT("app");
  const { lng } = useParams<{ lng: string }>();
  const router = useRouter();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const hasOthers = sessions.some((session) => !session.current);
  const busy = revoke.isPending || revokeOthers.isPending;

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {session.userAgent ? describeClient(session.userAgent) : t("settings.security.unknownDevice")}
                {session.current ? (
                  <span className="ms-2 rounded-full bg-background px-2 py-0.5 text-xs font-normal text-text-secondary">
                    {t("settings.security.thisDevice")}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-text-secondary">
                {t("settings.security.lastActive", { when: formatRelative(session.lastUsedAt, lng) })}
              </p>
            </div>
            {session.current ? null : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => revoke.mutate(session.id, { onSuccess: () => router.refresh() })}
              >
                {t("settings.security.signOutDevice")}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {hasOthers ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={busy}
          onClick={() => revokeOthers.mutate(undefined, { onSuccess: () => router.refresh() })}
        >
          {t("settings.security.signOutOthers")}
        </Button>
      ) : null}
    </div>
  );
}
