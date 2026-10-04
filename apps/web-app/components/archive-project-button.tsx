"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { useUpdateProject } from "@trestle/api-client/react";
import { Button } from "@trestle/ui/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@trestle/ui/components/ui/alert-dialog";

import { FormError } from "@trestle/ui/components/field";

// Archiving asks first because it removes the project from the dashboard and sidebar; restoring is
// harmless, so it just happens.
export function ArchiveProjectButton({ projectId, name, archived }: { projectId: string; name: string; archived: boolean }) {
  const { t } = useT("app");
  const { t: tCommon } = useT("common");
  const router = useRouter();
  const { lng } = useParams<{ lng: string }>();

  const [error, setError] = useState<string | null>(null);
  const updateProject = useUpdateProject();

  async function setStatus(status: "active" | "archived") {
    setError(null);
    try {
      await updateProject.mutateAsync({ id: projectId, status });
      // The sidebar, the project header and the lists are Server Components, so re-render them.
      if (status === "archived") router.push(`/${lng}/projects?tab=archived`);
      else router.refresh();
    } catch {
      setError(t("forms.genericError"));
    }
  }

  return (
    <>
      {archived ? (
        <Button variant="outline" disabled={updateProject.isPending} onClick={() => void setStatus("active")}>
          {updateProject.isPending ? t("projectView.restoring") : t("projectView.restore")}
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">{t("projectView.archive")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("projectView.archiveTitle", { name })}</AlertDialogTitle>
              <AlertDialogDescription>{t("projectView.archiveBody")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => void setStatus("archived")}>{t("projectView.archiveConfirm")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {error ? <FormError>{error}</FormError> : null}
    </>
  );
}
