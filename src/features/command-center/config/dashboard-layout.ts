export type DashboardArea =
  | "header"
  | "toolbar"
  | "filters"
  | "executive"
  | "financial"
  | "students"
  | "classes"
  | "agenda"
  | "championships"
  | "rentals"
  | "sponsorships"
  | "alerts";

export type DashboardLayoutItem = {
  area: DashboardArea;
  columns: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  order: number;
  width: "full" | "half" | "third" | "two-thirds";
};

export const DASHBOARD_COLUMN_COUNT = {
  desktop: 12,
  mobile: 1,
  tablet: 6,
} as const;

export const DASHBOARD_LAYOUT: DashboardLayoutItem[] = [
  {
    area: "header",
    columns: { desktop: 12, mobile: 1, tablet: 6 },
    order: 1,
    width: "full",
  },
  {
    area: "toolbar",
    columns: { desktop: 12, mobile: 1, tablet: 6 },
    order: 2,
    width: "full",
  },
  {
    area: "filters",
    columns: { desktop: 12, mobile: 1, tablet: 6 },
    order: 3,
    width: "full",
  },
  {
    area: "executive",
    columns: { desktop: 12, mobile: 1, tablet: 6 },
    order: 4,
    width: "full",
  },
  {
    area: "financial",
    columns: { desktop: 8, mobile: 1, tablet: 6 },
    order: 5,
    width: "two-thirds",
  },
  {
    area: "alerts",
    columns: { desktop: 4, mobile: 1, tablet: 6 },
    order: 6,
    width: "third",
  },
  {
    area: "students",
    columns: { desktop: 6, mobile: 1, tablet: 3 },
    order: 7,
    width: "half",
  },
  {
    area: "classes",
    columns: { desktop: 6, mobile: 1, tablet: 3 },
    order: 8,
    width: "half",
  },
  {
    area: "agenda",
    columns: { desktop: 6, mobile: 1, tablet: 6 },
    order: 9,
    width: "half",
  },
  {
    area: "championships",
    columns: { desktop: 6, mobile: 1, tablet: 6 },
    order: 10,
    width: "half",
  },
  {
    area: "rentals",
    columns: { desktop: 6, mobile: 1, tablet: 3 },
    order: 11,
    width: "half",
  },
  {
    area: "sponsorships",
    columns: { desktop: 6, mobile: 1, tablet: 3 },
    order: 12,
    width: "half",
  },
];
