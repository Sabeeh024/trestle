import { useAnnouncement } from "@/lib/announce";

/** Render once, near the top of the app. It is invisible, and present from the start so announcements are spoken. */
export function Announcer() {
  const message = useAnnouncement();
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
