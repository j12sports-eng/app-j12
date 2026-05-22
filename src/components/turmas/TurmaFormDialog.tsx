import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Modalidade } from "@/lib/alunos-store";
import { professorCanHandleClass, useProfessores } from "@/lib/professores-store";
import { useSettingsState } from "@/lib/settings/settings-store";
import { DIAS_SEMANA, turmasStore, type DiaSemana, type Turma } from "@/lib/turmas-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turma: Turma | null;
}

export function TurmaFormDialog({ open, onOpenChange, turma }: Props) {
  const editing = !!turma;
  const professores = useProfessores();
  const settings = useSettingsState();

  const [nome, setNome] = useState("");
  const [modalidade, setModalidade] = useState<Modalidade>("Futebol");
  const [unidade, setUnidade] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [dias, setDias] = useState<DiaSemana[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("19:00");
  const [horarioFim, setHorarioFim] = useState("20:30");
  const [capacidadeMaxima, setCapacidadeMaxima] = useState(20);
  const [ativa, setAtiva] = useState(true);

  const activeTeachers = useMemo(
    () => professores.filter((professor) => professor.status !== "inativo"),
    [professores],
  );

  const availableModalidades = useMemo(
    () =>
      [
        ...new Set(
          [
            ...settings.modalities.filter((item) => item.ativa).map((item) => item.nome),
            ...(turma ? [turma.modalidade] : []),
            modalidade,
          ].filter(Boolean),
        ),
      ] as Modalidade[],
    [modalidade, settings.modalities, turma],
  );

  const unitOptions = useMemo(
    () => [
      ...new Set(
        [
          ...settings.units.map((unit) => unit.nome),
          ...activeTeachers.flatMap((professor) => professor.unidades),
          unidade,
          ...(turma ? [turma.unidade] : []),
        ].filter(Boolean),
      ),
    ],
    [activeTeachers, settings.units, unidade, turma],
  );

  const compatibleTeachers = useMemo(
    () =>
      activeTeachers.filter(
        (professor) =>
          unidade.trim() &&
          professorCanHandleClass(professor, {
            modalidade,
            unidade,
          }),
      ),
    [activeTeachers, modalidade, unidade],
  );

  const selectedProfessor = compatibleTeachers.find((professor) => professor.id === professorId);

  useEffect(() => {
    if (!open) return;

    if (turma) {
      setNome(turma.nome ?? "");
      setModalidade(turma.modalidade ?? "Futebol");
      setUnidade(turma.unidade ?? "");
      setProfessorId(
        turma.professorId ??
          activeTeachers.find((professor) => professor.nome === turma.professor)?.id ??
          "",
      );
      setDias(turma.diasSemana ?? []);
      setHorarioInicio(turma.horarioInicio ?? "19:00");
      setHorarioFim(turma.horarioFim ?? "20:30");
      setCapacidadeMaxima(turma.capacidadeMaxima ?? 20);
      setAtiva(turma.ativa ?? true);
      return;
    }

    setNome("");
    setModalidade("Futebol");
    setUnidade(settings.units[0]?.nome ?? "");
    setProfessorId("");
    setDias([]);
    setHorarioInicio("19:00");
    setHorarioFim("20:30");
    setCapacidadeMaxima(20);
    setAtiva(true);
  }, [activeTeachers, open, settings.units, turma]);

  useEffect(() => {
    if (!professorId) return;
    if (compatibleTeachers.some((professor) => professor.id === professorId)) return;
    setProfessorId("");
  }, [compatibleTeachers, professorId]);

  function toggleDia(dia: DiaSemana) {
    setDias((prev) =>
      prev.includes(dia) ? prev.filter((value) => value !== dia) : [...prev, dia],
    );
  }

  function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome da turma");
    if (!unidade.trim()) return toast.error("Informe a unidade da turma");
    if (!professorId) return toast.error("Selecione um professor responsável");
    if (dias.length === 0) return toast.error("Selecione pelo menos um dia da semana");
    if (capacidadeMaxima < 1) return toast.error("Capacidade deve ser maior que zero");
    if (horarioFim <= horarioInicio) return toast.error("Horário fim deve ser após o início");

    if (turma && capacidadeMaxima < turma.alunoIds.length) {
      return toast.error(
        `Capacidade não pode ser menor que ${turma.alunoIds.length} alunos atuais`,
      );
    }

    if (!selectedProfessor) {
      return toast.error(
        "O professor selecionado não atende esta combinação de unidade e modalidade.",
      );
    }

    const payload = {
      nome: nome.trim(),
      modalidade,
      unidade: unidade.trim(),
      professorId: selectedProfessor.id,
      professor: selectedProfessor.nome,
      diasSemana: dias,
      horarioInicio,
      horarioFim,
      capacidadeMaxima,
      ativa,
    };

    if (editing && turma) {
      turmasStore.update(turma.id, payload);
      toast.success("Turma atualizada");
    } else {
      turmasStore.create(payload);
      toast.success("Turma criada");
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar turma" : "Nova turma"}</DialogTitle>
          <DialogDescription>
            Defina os dados da turma, horários, capacidade e um professor compatível com a unidade e
            a modalidade escolhidas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da turma</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Sub-11 Tarde"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Modalidade</Label>
              <Select
                value={modalidade}
                onValueChange={(value) => setModalidade(value as Modalidade)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModalidades.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Input
                id="unidade"
                list="turma-unidades"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                placeholder="Ex: Unidade Pirituba"
              />
              <datalist id="turma-unidades">
                {unitOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Professor responsável</Label>
            <Select value={professorId} onValueChange={setProfessorId} disabled={!unidade.trim()}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    unidade.trim()
                      ? compatibleTeachers.length > 0
                        ? "Selecione um professor"
                        : "Nenhum professor compatível"
                      : "Escolha a unidade primeiro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {compatibleTeachers.map((professor) => (
                  <SelectItem key={professor.id} value={professor.id}>
                    {professor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-xs text-muted-foreground">
              Apenas professores com esta modalidade e esta unidade podem ser vinculados.
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => {
                const active = dias.includes(dia.value);

                return (
                  <button
                    key={dia.value}
                    type="button"
                    onClick={() => toggleDia(dia.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {dia.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hi">Início</Label>
              <Input
                id="hi"
                type="time"
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hf">Fim</Label>
              <Input
                id="hf"
                type="time"
                value={horarioFim}
                onChange={(e) => setHorarioFim(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cap">Capacidade máxima</Label>
              <Input
                id="cap"
                type="number"
                min={1}
                value={capacidadeMaxima}
                onChange={(e) =>
                  setCapacidadeMaxima(Math.max(1, parseInt(e.target.value || "1", 10)))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div>
              <div className="text-sm font-medium">Turma ativa</div>
              <div className="text-xs text-muted-foreground">
                Turmas inativas não recebem novos alunos.
              </div>
            </div>
            <Switch checked={ativa} onCheckedChange={setAtiva} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{editing ? "Salvar" : "Criar turma"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
