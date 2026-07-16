export type RecentActivityItem = {
  description?: string;
  id: string;
  occurredAt: string;
  title: string;
};

export function RecentActivityWidget({ items }: { items: RecentActivityItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="relative border-l border-white/10 pl-4">
          <span className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-primary" />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <strong className="text-sm text-white">{item.title}</strong>
            <time className="text-xs font-semibold text-slate-500">{item.occurredAt}</time>
          </div>
          {item.description ? (
            <p className="mt-1 text-sm text-slate-400">{item.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
