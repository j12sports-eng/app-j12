export type PreviewFieldProps = {
  label: string;
  value: string;
};

/** Shared compact card for technical preview metadata. */
export function PreviewField({ label, value }: PreviewFieldProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
