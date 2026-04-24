import { useMemo, useState } from "react";
import { Link2, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAlunoScope, getAlunoTurmas, useAlunos } from "@/lib/alunos-store";
import { settingsStore, useSettingsState } from "@/lib/settings/settings-store";
import type { SettingsUser, UserRole } from "@/lib/settings/types";
import { useProfessores } from "@/lib/professores-store";
import { useTurmas } from "@/lib/turmas-store";
import { SettingsEmptyState, SettingsPanel } from "./shared";

type UserFormState = {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  teacherId: string;
  studentId: string;
  classIds: string[];
  ativo: boolean;
};

const defaultForm: UserFormState = {
  nome: "",
  email: "",
  senha: "123456",
  role: "professor",
  teacherId: "",
  studentId: "",
  classIds: [],
  ativo: true,
};

export function UsersSettings() {
  const settings = useSettingsState();
  const alunos = useAlunos();
  const professores = useProfessores();
  const turmas = useTurmas();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SettingsUser | null>(null);
  const [form, setForm] = useState<UserFormState>(defaultForm);

  const professorOptions = useMemo(
    () => professores.filter((professor) => professor.status !== "inativo"),
    [professores],
  );
  const alunoOptions = useMemo(
    () => alunos.filter((aluno) => aluno.status !== "inativo"),
    [alunos],
  );

  function updatePermission(role: SettingsUser["role"], field: "canViewSelfOnly" | "canEditSelfOnly", value: boolean) {
    settingsStore.savePermissions(
      settings.permissions.map((permission) =>
        permission.role === role ? { ...permission, [field]: value } : permission,
      ),
    );
    toast.success("Permissões globais atualizadas.");
  }

  function openCreate() {
    setEditingUser(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(user: SettingsUser) {
    setEditingUser(user);
    setForm({
      nome: user.nome,
      email: user.email,
      senha: user.senha,
      role: user.role,
      teacherId: user.teacherId ?? "",
      studentId: user.studentId ?? "",
      classIds: user.classIds,
      ativo: user.ativo,
    });
    setDialogOpen(true);
  }

  function toggleClass(classId: string) {
    setForm((current) => ({
      ...current,
      classIds: current.classIds.includes(classId)
        ? current.classIds.filter((item) => item !== classId)
        : [...current.classIds, classId],
    }));
  }

  function handleSave() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error("Nome e e-mail sao obrigatorios.");
      return;
    }

    if (form.role === "professor" && !form.teacherId) {
      toast.error("Vincule o usuario professor a um cadastro de professor.");
      return;
    }

    if (form.role === "aluno" && !form.studentId) {
      toast.error("Vincule o usuario aluno a um cadastro de aluno.");
      return;
    }

    const payload = {
      nome: form.nome,
      email: form.email,
      senha: form.senha,
      role: form.role,
      teacherId: form.role === "professor" ? form.teacherId : null,
      studentId: form.role === "aluno" ? form.studentId : null,
      classIds: form.role === "professor" ? form.classIds : [],
      ativo: form.ativo,
    };

    if (editingUser) {
      settingsStore.updateUser(editingUser.id, payload);
      toast.success("Usuario atualizado.");
    } else {
      settingsStore.createUser(payload);
      toast.success("Usuario criado.");
    }

    setDialogOpen(false);
  }

  function handleDelete(user: SettingsUser) {
    if (!window.confirm(`Excluir o usuario ${user.nome}?`)) return;
    settingsStore.removeUser(user.id);
    toast.success("Usuario removido.");
  }

  return (
    <SettingsPanel
      title="Usuarios e permissoes"
      description="Gerencie perfis, vinculos com professores e alunos, e o acesso operacional do sistema."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-400">
          {settings.users.length} usuario(s) configurado(s) para acesso administrativo, docente e
          discente.
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo usuario
        </Button>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {settings.permissions.map((permission) => (
          <div key={permission.role} className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-100 capitalize">{permission.role}</div>
                <div className="mt-1 text-xs text-slate-400">
                  Escopo: {permission.profileScope} · Acesso: {permission.accessLevel}
                </div>
              </div>
              <Badge className="border-primary/20 bg-primary/10 text-primary">
                {permission.canViewSelfOnly ? "Self only" : "Amplo"}
              </Badge>
            </div>
            {permission.role === "aluno" ? (
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  Visualizar apenas o próprio perfil
                  <input
                    type="checkbox"
                    checked={permission.canViewSelfOnly}
                    onChange={(event) =>
                      updatePermission(permission.role, "canViewSelfOnly", event.target.checked)
                    }
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  Editar apenas o próprio cadastro
                  <input
                    type="checkbox"
                    checked={permission.canEditSelfOnly}
                    onChange={(event) =>
                      updatePermission(permission.role, "canEditSelfOnly", event.target.checked)
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 text-xs text-slate-500">
                Regras administrativas e operacionais aplicadas globalmente ao sistema.
              </div>
            )}
          </div>
        ))}
      </div>

      {settings.users.length === 0 ? (
        <SettingsEmptyState
          title="Nenhum usuario cadastrado"
          description="Crie perfis administrativos, docentes e de aluno para controlar o acesso aos modulos."
          icon={Shield}
        />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/10">
                <TableHead>Usuario</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Vinculo</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.users.map((user) => {
                const linkedTeacher =
                  professores.find((professor) => professor.id === user.teacherId)?.nome ?? "—";
                const linkedStudent =
                  alunos.find((aluno) => aluno.id === user.studentId)?.nome ?? "—";
                const linkedEntity =
                  user.role === "professor"
                    ? linkedTeacher
                    : user.role === "aluno"
                      ? linkedStudent
                      : "—";
                const scopeLabel =
                  user.role === "professor"
                    ? user.classIds.length || "—"
                    : user.role === "aluno"
                      ? (() => { const aluno = alunos.find((item) => item.id === user.studentId); return aluno ? formatAlunoScope(getAlunoTurmas(aluno)) : "—"; })()
                      : "Acesso total";

                return (
                  <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div className="font-medium text-slate-100">{user.nome}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className="border-primary/20 bg-primary/10 text-primary">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">{linkedEntity}</TableCell>
                    <TableCell className="text-slate-300">{scopeLabel}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.ativo
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-500/15 text-slate-300"
                        }
                      >
                        {user.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl border-white/10 bg-[#09101b] text-slate-100">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuario" : "Novo usuario"}</DialogTitle>
            <DialogDescription>
              Professores podem ser vinculados a turmas e alunos podem ser vinculados ao proprio
              cadastro para refletir as regras de acesso do sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nome"
              value={form.nome}
              onChange={(value) => setForm((current) => ({ ...current, nome: value }))}
            />
            <Field
              label="E-mail"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />
            <Field
              label="Senha mock"
              value={form.senha}
              onChange={(value) => setForm((current) => ({ ...current, senha: value }))}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Perfil</label>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                    teacherId: event.target.value === "professor" ? current.teacherId : "",
                    studentId: event.target.value === "aluno" ? current.studentId : "",
                    classIds: event.target.value === "professor" ? current.classIds : [],
                  }))
                }
                className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-primary"
              >
                <option value="admin">admin</option>
                <option value="coordenador">coordenador</option>
                <option value="professor">professor</option>
                <option value="aluno">aluno</option>
              </select>
            </div>
          </div>

          {form.role === "professor" ? (
            <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
              <div className="space-y-2 rounded-3xl border border-white/10 bg-black/20 p-4">
                <label className="text-sm font-medium text-slate-200">Professor vinculado</label>
                <select
                  value={form.teacherId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, teacherId: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-slate-100 outline-none focus:border-primary"
                >
                  <option value="">Selecione um professor</option>
                  {professorOptions.map((professor) => (
                    <option key={professor.id} value={professor.id}>
                      {professor.nome}
                    </option>
                  ))}
                </select>

                <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, ativo: event.target.checked }))
                    }
                  />
                  Usuario ativo
                </label>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Link2 className="h-4 w-4 text-primary" />
                  Turmas liberadas para este usuario
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {turmas.map((turma) => (
                    <label
                      key={turma.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={form.classIds.includes(turma.id)}
                        onChange={() => toggleClass(turma.id)}
                      />
                      <span>
                        <span className="block font-medium text-slate-100">{turma.nome}</span>
                        <span className="block text-xs text-slate-500">{turma.professor}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : form.role === "aluno" ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2 rounded-3xl border border-white/10 bg-black/20 p-4">
                <label className="text-sm font-medium text-slate-200">Aluno vinculado</label>
                <select
                  value={form.studentId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, studentId: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-slate-100 outline-none focus:border-primary"
                >
                  <option value="">Selecione um aluno</option>
                  {alunoOptions.map((aluno) => (
                    <option key={aluno.id} value={aluno.id}>
                      {aluno.nome}
                    </option>
                  ))}
                </select>

                <p className="text-xs text-slate-500">
                  Esse vinculo identifica qual cadastro de aluno corresponde ao login deste
                  usuario.
                </p>
              </div>

              <div className="space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium text-slate-200">Status do acesso</div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, ativo: event.target.checked }))
                    }
                  />
                  Usuario ativo
                </label>
              </div>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ativo: event.target.checked }))
                }
              />
              Usuario ativo
            </label>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editingUser ? "Salvar usuario" : "Criar usuario"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-white/10 bg-black/20 text-slate-100"
      />
    </div>
  );
}

