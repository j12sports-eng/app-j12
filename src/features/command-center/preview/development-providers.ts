import type { BIAdapterInput } from "../adapters/shared";
import type { ChampionshipsContractData, ChampionshipsKPIs } from "../contracts/championships";
import type { ClassesContractData, ClassesKPIs } from "../contracts/classes";
import type { CommunicationContractData, CommunicationKPIs } from "../contracts/communication";
import type { FinancialContractData, FinancialKPIs } from "../contracts/financial";
import type { GuardianPortalContractData, GuardianPortalKPIs } from "../contracts/guardian-portal";
import type { LibraryContractData, LibraryKPIs } from "../contracts/library";
import type { KPIDefinition, KPIUnit } from "../contracts/shared";
import type { StudentsContractData, StudentsKPIs } from "../contracts/students";
import type { ProfessorsContractData, ProfessorsKPIs } from "../contracts/teachers";
import type { StudentPortalContractData, StudentPortalKPIs } from "../contracts/athlete-portal";
import type { CourtsContractData, CourtsKPIs } from "../contracts/arena";
import { createCourtsProvider } from "../providers/arena";
import { createStudentPortalProvider } from "../providers/athlete-portal";
import { createChampionshipsProvider } from "../providers/championships";
import { createClassesProvider } from "../providers/classes";
import { createCommunicationProvider } from "../providers/communication";
import { createFinancialProvider } from "../providers/financial";
import { createGuardianPortalProvider } from "../providers/guardian-portal";
import { createLibraryProvider } from "../providers/library";
import { createStudentsProvider } from "../providers/students";
import { createProfessorsProvider } from "../providers/teachers";

const PREVIEW_REASON = "Fonte real do ERP ainda não vinculada ao Provider de desenvolvimento.";

function unavailable<TUnit extends KPIUnit>(unit: TUnit): KPIDefinition<TUnit> {
  return { available: false, reason: PREVIEW_REASON, unit, value: null };
}

function previewInput<TKpis, TData>(
  sourceName: string,
  kpis: TKpis,
  data: TData,
): BIAdapterInput<TKpis, TData> {
  const generatedAt = new Date().toISOString();
  const today = generatedAt.slice(0, 10);

  return {
    capabilities: ["PREVIEW_ONLY"],
    contractVersion: "preview-1",
    data,
    filters: {
      applied: {},
      period: {
        endDate: today,
        inclusive: { endDate: true, startDate: true },
        period: "TODAY",
        startDate: today,
        timezone: "America/Sao_Paulo",
      },
      supportedFilters: ["period", "unit"],
      unit: { authorizedUnitIds: [], mode: "all", selectedUnitIds: [] },
    },
    generatedAt,
    kpis,
    metadata: {
      cacheTtlSeconds: 0,
      partial: true,
      warnings: [PREVIEW_REASON],
    },
    source: { domains: [sourceName], name: `command-center-preview:${sourceName}` },
  };
}

const financialKPIs: FinancialKPIs = {
  averageTicket: unavailable("currency"),
  expenses: unavailable("currency"),
  expectedRevenue: unavailable("currency"),
  goalAchievement: unavailable("percentage"),
  netResult: unavailable("currency"),
  overdueRevenue: unavailable("currency"),
  pendingRevenue: unavailable("currency"),
  receivedRevenue: unavailable("currency"),
};
const financialData: FinancialContractData = { breakdowns: {}, evolution: [] };

const studentsKPIs: StudentsKPIs = {
  activeEnrollments: unavailable("count"),
  activeStudents: unavailable("count"),
  averageTenureDays: unavailable("days"),
  cancellations: unavailable("count"),
  churnRate: unavailable("percentage"),
  netGrowth: unavailable("count"),
  newEnrollments: unavailable("count"),
  newStudents: unavailable("count"),
  retentionRate: unavailable("percentage"),
};
const studentsData: StudentsContractData = { distributions: {}, evolution: [] };

const classesKPIs: ClassesKPIs = {
  activeClasses: unavailable("count"),
  attendanceRate: unavailable("percentage"),
  availableSpots: unavailable("count"),
  fullClasses: unavailable("count"),
  occupancyRate: unavailable("percentage"),
  underutilizedClasses: unavailable("count"),
};
const classesData: ClassesContractData = { classes: [] };

const professorsKPIs: ProfessorsKPIs = {
  activeProfessors: unavailable("count"),
  allocatedHours: unavailable("hours"),
  allocatedProfessors: unavailable("count"),
  classesWithoutProfessor: unavailable("count"),
  pendingContracts: unavailable("count"),
  scheduleConflicts: unavailable("count"),
};
const professorsData: ProfessorsContractData = { allocations: [] };

const courtsKPIs: CourtsKPIs = {
  availableHours: unavailable("hours"),
  cancellations: unavailable("count"),
  occupancyRate: unavailable("percentage"),
  rentalRevenue: unavailable("currency"),
  reservedHours: unavailable("hours"),
  ticketAverage: unavailable("currency"),
};
const courtsData: CourtsContractData = {};

const championshipsKPIs: ChampionshipsKPIs = {
  activeChampionships: unavailable("count"),
  averageTeams: unavailable("average"),
  completedChampionships: unavailable("count"),
  finishedMatches: unavailable("count"),
  participants: unavailable("count"),
  pendingMatches: unavailable("count"),
  registrationRevenue: unavailable("currency"),
  registrations: unavailable("count"),
  teams: unavailable("count"),
};
const championshipsData: ChampionshipsContractData = {
  categories: [],
  registrationEvolution: [],
  statuses: [],
};

const communicationKPIs: CommunicationKPIs = {
  activeCampaigns: unavailable("count"),
  deliveryRate: unavailable("percentage"),
  failedMessages: unavailable("count"),
  readRate: unavailable("percentage"),
  reach: unavailable("count"),
  sentMessages: unavailable("count"),
};
const communicationData: CommunicationContractData = { channels: [] };

const libraryKPIs: LibraryKPIs = {
  activeContents: unavailable("count"),
  downloads: unavailable("count"),
  engagementRate: unavailable("percentage"),
  outdatedContents: unavailable("count"),
  views: unavailable("count"),
};
const libraryData: LibraryContractData = { contents: [] };

const studentPortalKPIs: StudentPortalKPIs = {
  accessFrequency: unavailable("average"),
  activeUsers: unavailable("count"),
  pendingActions: unavailable("count"),
  portalPayments: unavailable("currency"),
};
const studentPortalData: StudentPortalContractData = { recentActivity: [] };

const guardianPortalKPIs: GuardianPortalKPIs = {
  accesses: unavailable("count"),
  activeGuardians: unavailable("count"),
  messagesRead: unavailable("count"),
  pendingActions: unavailable("count"),
  portalPayments: unavailable("currency"),
};
const guardianPortalData: GuardianPortalContractData = { recentActivity: [] };

export const commandCenterPreviewProviders = {
  arena: createCourtsProvider({
    load: () => previewInput("arena", courtsKPIs, courtsData),
  }),
  athletePortal: createStudentPortalProvider({
    load: () => previewInput("athlete-portal", studentPortalKPIs, studentPortalData),
  }),
  championships: createChampionshipsProvider({
    load: () => previewInput("championships", championshipsKPIs, championshipsData),
  }),
  classes: createClassesProvider({
    load: () => previewInput("classes", classesKPIs, classesData),
  }),
  communication: createCommunicationProvider({
    load: () => previewInput("communication", communicationKPIs, communicationData),
  }),
  financial: createFinancialProvider({
    load: () => previewInput("financial", financialKPIs, financialData),
  }),
  guardianPortal: createGuardianPortalProvider({
    load: () => previewInput("guardian-portal", guardianPortalKPIs, guardianPortalData),
  }),
  library: createLibraryProvider({
    load: () => previewInput("library", libraryKPIs, libraryData),
  }),
  students: createStudentsProvider({
    load: () => previewInput("students", studentsKPIs, studentsData),
  }),
  teachers: createProfessorsProvider({
    load: () => previewInput("teachers", professorsKPIs, professorsData),
  }),
};
