import Link from "next/link";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 && <span className="text-neutral-600">/</span>}
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-amber-400">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-neutral-300" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
