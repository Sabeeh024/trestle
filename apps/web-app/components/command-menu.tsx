"use client";

import { useEffect, useId, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useT } from "next-i18next/client";

import { useApi } from "@trestle/api-client/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@trestle/ui/components/ui/dialog";

import { useDebouncedValue } from "@/lib/use-debounced-value";

interface Result {
  id: string;
  group: "pages" | "projects" | "tasks";
  label: string;
  hint?: string;
  href: string;
}

// The top bar's search box. It opens a palette that searches projects and tasks as you type, and lists
// the app's pages when empty, so it works as a keyboard launcher too (Cmd or Ctrl + K).
export function CommandMenu({ placeholder }: { placeholder: string }) {
  const { t } = useT("app");
  const router = useRouter();
  const { lng } = useParams<{ lng: string }>();
  const { queries } = useApi();
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const q = useDebouncedValue(query.trim());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searching = q.length > 0;
  const projects = useQuery({ ...queries.projects.list({ q, pageSize: 5 }), enabled: open && searching });
  const tasks = useQuery({ ...queries.tasks.list({ q, pageSize: 5 }), enabled: open && searching });
  const loading = searching && (projects.isFetching || tasks.isFetching);

  const pages: Result[] = (
    [
      ["dashboard", "home"],
      ["my-tasks", "myTasks"],
      ["projects", "projects"],
      ["settings", "settings"],
    ] as const
  ).map(([path, label]) => ({ id: `page-${path}`, group: "pages", label: t(`nav.${label}`), href: `/${lng}/${path}` }));

  const results: Result[] = searching
    ? [
        ...(projects.data?.data ?? []).map<Result>((project) => ({
          id: `project-${project.id}`,
          group: "projects",
          label: project.name,
          href: `/${lng}/projects/${project.id}`,
        })),
        ...(tasks.data?.data ?? []).map<Result>((task) => ({
          id: `task-${task.id}`,
          group: "tasks",
          label: task.title,
          hint: task.id,
          href: `/${lng}/projects/${task.projectId}?task=${task.id}`,
        })),
      ]
    : pages;

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function go(result: Result | undefined) {
    if (!result) return;
    close();
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  const groups = (["pages", "projects", "tasks"] as const)
    .map((group) => ({ group, items: results.filter((result) => result.group === group) }))
    .filter(({ items }) => items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-90 flex-1 items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-start"
      >
        <span className="text-sm text-text-disabled">{placeholder}</span>
        <kbd className="rounded-sm border border-border-strong px-1 text-xs font-semibold text-text-disabled">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent showCloseButton={false} className="top-24 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">{t("search.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("search.description")}</DialogDescription>

          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            aria-label={t("search.inputLabel")}
            placeholder={t("search.inputLabel")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="w-full border-b border-border bg-transparent px-4 py-3 text-base outline-none placeholder:text-text-disabled"
          />

          <div id={listId} role="listbox" className="max-h-80 overflow-y-auto p-2">
            {groups.map(({ group, items }) => (
              <div key={group} role="group" aria-label={t(`search.${group}`)} className="mb-1">
                <p className="px-2 py-1.5 text-xs font-semibold text-text-disabled">{t(`search.${group}`)}</p>
                {items.map((result) => {
                  const index = results.indexOf(result);
                  return (
                    <div
                      key={result.id}
                      id={`${listId}-${result.id}`}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(result)}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm ${
                        index === active ? "bg-muted" : ""
                      }`}
                    >
                      <span className="truncate">{result.label}</span>
                      {result.hint ? <span className="shrink-0 text-xs text-text-disabled">{result.hint}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))}

            {searching && loading && results.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-text-secondary">{t("search.searching")}</p>
            ) : null}
            {searching && !loading && results.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-text-secondary">
                {projects.error || tasks.error ? t("search.failed") : t("search.empty", { query: q })}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
