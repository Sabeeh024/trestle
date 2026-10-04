import Link from "next/link";

// A row of pill tabs that are plain links, so the selected view lives in the URL, survives a reload and
// is rendered on the server with no client state.
export function TabLinks({ items }: { items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav className="flex gap-1 self-start rounded-md bg-muted p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`rounded-sm px-3 py-1.5 text-sm ${
            item.active ? "bg-background font-semibold shadow-sm" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
