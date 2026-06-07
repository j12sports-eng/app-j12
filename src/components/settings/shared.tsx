import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Blocks,
  BrushCleaning,
  Building2,
  FileText,
  GraduationCap,
  LayoutGrid,
  PlugZap,
  Settings2,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { SkeletonCard, SkeletonForm } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "@/lib/settings/types";

export const settingsSections: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "geral", label: "Geral", description: "Dados institucionais e marca.", icon: Settings2 },
  {
    id: "aparencia",
    label: "Aparencia",
    description: "Tema, cores, botoes e contraste.",
    icon: BrushCleaning,
  },
  {
    id: "usuarios",
    label: "Usuarios e Permissoes",
    description: "Perfis, vinculos e acesso.",
    icon: ShieldCheck,
  },
  { id: "unidades", label: "Unidades", description: "Nucleos e telefones.", icon: Building2 },
  {
    id: "modalidades",
    label: "Modalidades",
    description: "Catalogo e destaque visual.",
    icon: Blocks,
  },
  {
    id: "turmas",
    label: "Turmas",
    description: "Agenda, lotacao e responsavel.",
    icon: GraduationCap,
  },
  {
    id: "professores",
    label: "Professores",
    description: "Equipe, documentos e vinculos.",
    icon: UserCog,
  },
  { id: "contratos", label: "Contratos", description: "Templates e variaveis.", icon: FileText },
  {
    id: "notificacoes",
    label: "Notificacoes",
    description: "Lembretes e cobrancas.",
    icon: BellRing,
  },
  {
    id: "integracoes",
    label: "Integracoes",
    description: "APIs, bancos e webhooks.",
    icon: PlugZap,
  },
];

export function SettingsPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("j12-surface p-5", className)}>
      <div className="mb-5 flex flex-col gap-1 border-b border-border/60 pb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsMetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
}) {
  return (
    <div className="j12-kpi-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="j12-icon-chip p-2">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{helper}</div>
    </div>
  );
}

export function SettingsEmptyState({
  title,
  description,
  icon: Icon = LayoutGrid,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="j12-empty-state p-10 text-center">
      <div className="j12-icon-chip mx-auto flex h-14 w-14 items-center justify-center">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="mt-4 text-base font-semibold text-foreground">{title}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SettingsSectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} lines={2} className="min-h-[132px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        <SkeletonForm fields={6} className="min-h-[420px]" />
        <SkeletonForm fields={8} className="min-h-[420px]" />
      </div>
    </div>
  );
}
