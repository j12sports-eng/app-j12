import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Pencil,
  RefreshCcw,
  UserPlus2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canConfirmTrialClass,
  canConvertTrialClass,
  canEditTrialClass,
  canMarkAttendance,
  canCancelTrialClass,
  canRescheduleTrialClass,
  type TrialClass,
} from "@/lib/trial-classes-store";
import { TrialClassStatusBadge } from "./TrialClassStatusBadge";

function actionLoadingKey(id: string, action: string) {
  return `${id}:${action}`;
}

export function TrialClassTable({
  items,
  busyKey,
  onView,
  onEdit,
  onConfirm,
  onAttended,
  onNoShow,
  onReschedule,
  onConvert,
  onCancel,
}: {
  items: TrialClass[];
  busyKey: string | null;
  onView: (item: TrialClass) => void;
  onEdit: (item: TrialClass) => void;
  onConfirm: (item: TrialClass) => void;
  onAttended: (item: TrialClass) => void;
  onNoShow: (item: TrialClass) => void;
  onReschedule: (item: TrialClass) => void;
  onConvert: (item: TrialClass) => void;
  onCancel: (item: TrialClass) => void;
}) {
  return (
    <>
      <div className="j12-table-shell hidden xl:block">
        <table className="w-full text-sm">
          <thead className="j12-table-head text-left text-xs uppercase tracking-[0.16em]">
            <tr>
              <th className="px-5 py-4">Aluno</th>
              <th className="px-5 py-4">Responsavel</th>
              <th className="px-5 py-4">Telefone</th>
              <th className="px-5 py-4">Modalidade</th>
              <th className="px-5 py-4">Professor</th>
              <th className="px-5 py-4">Data</th>
              <th className="px-5 py-4">Horario</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => (
              <tr key={item.id} className="j12-table-row">
                <td className="px-5 py-4">
                  <div className="font-semibold text-foreground">{item.studentName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.unit}</div>
                </td>
                <td className="px-5 py-4 text-foreground/90">{item.guardianName}</td>
                <td className="px-5 py-4 text-foreground/90">{item.phone}</td>
                <td className="px-5 py-4 text-foreground/90">{item.modality}</td>
                <td className="px-5 py-4 text-foreground/90">{item.professor}</td>
                <td className="px-5 py-4 text-foreground/90">{item.date}</td>
                <td className="px-5 py-4 text-foreground/90">{item.time}</td>
                <td className="px-5 py-4">
                  <TrialClassStatusBadge status={item.status} />
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onView(item)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver
                    </Button>

                    {canEditTrialClass(item) && (
                      <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                    )}

                    {canConfirmTrialClass(item) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyKey === actionLoadingKey(item.id, "confirm")}
                        onClick={() => onConfirm(item)}
                      >
                        Confirmar
                      </Button>
                    )}

                    {canMarkAttendance(item) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyKey === actionLoadingKey(item.id, "attended")}
                          onClick={() => onAttended(item)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Compareceu
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyKey === actionLoadingKey(item.id, "no-show")}
                          onClick={() => onNoShow(item)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Faltou
                        </Button>
                      </>
                    )}

                    {canRescheduleTrialClass(item) && (
                      <Button size="sm" variant="outline" onClick={() => onReschedule(item)}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Reagendar
                      </Button>
                    )}

                    {canConvertTrialClass(item) && (
                      <Button
                        size="sm"
                        onClick={() => onConvert(item)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <UserPlus2 className="mr-2 h-4 w-4" />
                        Converter
                      </Button>
                    )}

                    {canCancelTrialClass(item) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyKey === actionLoadingKey(item.id, "cancel")}
                        onClick={() => onCancel(item)}
                        className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:hidden">
        {items.map((item) => (
          <article key={item.id} className="j12-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">{item.studentName}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.guardianName}</div>
              </div>
              <TrialClassStatusBadge status={item.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-foreground/90">
              <QuickInfo label="Modalidade" value={item.modality} />
              <QuickInfo label="Professor" value={item.professor} />
              <QuickInfo label="Data" value={item.date} />
              <QuickInfo label="Horario" value={item.time} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onView(item)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver
              </Button>
              {canEditTrialClass(item) && (
                <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              )}
              {canConfirmTrialClass(item) && (
                <Button size="sm" variant="outline" onClick={() => onConfirm(item)}>
                  Confirmar
                </Button>
              )}
              {canMarkAttendance(item) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => onAttended(item)}>
                    Compareceu
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onNoShow(item)}>
                    Faltou
                  </Button>
                </>
              )}
              {canRescheduleTrialClass(item) && (
                <Button size="sm" variant="outline" onClick={() => onReschedule(item)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Reagendar
                </Button>
              )}
              {canConvertTrialClass(item) && (
                <Button
                  size="sm"
                  onClick={() => onConvert(item)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Converter
                </Button>
              )}
              {canCancelTrialClass(item) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(item)}
                  className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="j12-panel-section p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
