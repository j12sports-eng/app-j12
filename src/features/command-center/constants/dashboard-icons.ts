import {
  Activity,
  CalendarCheck,
  CreditCard,
  Gauge,
  GraduationCap,
  ShieldAlert,
  Trophy,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

export const DASHBOARD_ICONS = {
  activeChampionships: Trophy,
  activeClasses: GraduationCap,
  activeStudents: Users,
  attendance: CalendarCheck,
  averageTicket: CreditCard,
  delinquency: ShieldAlert,
  newStudents: UserPlus,
  occupancy: Gauge,
  performance: Activity,
  revenue: Wallet,
} as const;
