import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { formatApiErrorMessage } from "@/lib/api";
import { downloadBiExport, type BiExportFormat, type BiExportReport } from "../api/bi-export.api";
import type { BiFoundationFilters, BiPeriod } from "../types/bi-foundation.types";

const REPORTS: Array<{ value: BiExportReport; label: string }> = [
  { value: "executive", label: "Executivo" },
  { value: "financial", label: "Financeiro" },
  { value: "students", label: "Alunos e matriculas" },
  { value: "classes", label: "Turmas" },
  { value: "delinquency", label: "Inadimplencia" },
  { value: "courts", label: "Quadras" },
  { value: "championships", label: "Campeonatos" },
];
export function BiExportsDashboard() {
  const [report, setReport] = useState<BiExportReport>("executive");
  const [format, setFormat] = useState<BiExportFormat>("csv");
  const [filters, setFilters] = useState<BiFoundationFilters>({ period: "CURRENT_MONTH" });
  const [loading, setLoading] = useState(false);
  const valid =
    filters.period !== "CUSTOM" ||
    Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate);
  async function download() {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await downloadBiExport(report, format, filters);
      toast.success("Relatorio exportado com sucesso.");
    } catch (error) {
      toast.error(formatApiErrorMessage(error, "Falha ao exportar relatorio."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <AppShell title="Relatorios do BI">
      <div className="space-y-6">
        <header className="j12-surface p-6">
          <div className="flex items-center gap-2 text-primary">
            <FileSpreadsheet /> Relatorios exportaveis
          </div>
          <h1 className="mt-3 text-3xl font-black text-white">
            Exporte os mesmos dados dos dashboards
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            CSV e XLSX para analise; PDF para leitura. Limite de 5.000 linhas por arquivo.
          </p>
        </header>
        <section className="j12-surface grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Relatorio">
            <select
              value={report}
              onChange={(event) => setReport(event.target.value as BiExportReport)}
            >
              {REPORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Formato">
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as BiExportFormat)}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel / XLSX</option>
              <option value="pdf">PDF</option>
            </select>
          </Field>
          <Field label="Periodo">
            <select
              value={filters.period}
              onChange={(event) => setFilters({ period: event.target.value as BiPeriod })}
            >
              <option value="CURRENT_MONTH">Mes atual</option>
              <option value="LAST_30_DAYS">Ultimos 30 dias</option>
              <option value="CURRENT_YEAR">Ano atual</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
          </Field>
          <Field label="Unidade">
            <input
              value={filters.unitId || ""}
              onChange={(event) =>
                setFilters({ ...filters, unitId: event.target.value || undefined })
              }
              placeholder="Todas"
            />
          </Field>
          {filters.period === "CUSTOM" && (
            <>
              <Field label="Inicio">
                <input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(event) => setFilters({ ...filters, startDate: event.target.value })}
                />
              </Field>
              <Field label="Fim">
                <input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(event) => setFilters({ ...filters, endDate: event.target.value })}
                />
              </Field>
            </>
          )}
          <button
            disabled={!valid || loading}
            onClick={download}
            className="min-h-11 self-end rounded-xl bg-primary px-4 font-bold text-black disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="mx-auto animate-spin" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="h-4 w-4" /> Exportar
              </span>
            )}
          </button>
        </section>
        {!valid && (
          <p className="text-sm text-amber-300">Informe um periodo personalizado valido.</p>
        )}
      </div>
    </AppShell>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-slate-400">
      {label}
      <span className="[&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-white/10 [&>*]:bg-black/40 [&>*]:px-3 [&>*]:text-white">
        {children}
      </span>
    </label>
  );
}
