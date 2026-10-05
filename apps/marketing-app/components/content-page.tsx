// The plain reading layout shared by the About, Privacy, Terms, Blog and Careers pages.
export function ContentPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-4xl leading-heading font-bold">{title}</h1>
      <p className="mt-4 text-lg text-text-secondary">{intro}</p>
      {updated ? <p className="mt-2 text-sm text-text-tertiary">{updated}</p> : null}
      <div className="mt-12 flex flex-col gap-10">{children}</div>
    </article>
  );
}

export function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-text-secondary">{children}</p>
    </section>
  );
}
