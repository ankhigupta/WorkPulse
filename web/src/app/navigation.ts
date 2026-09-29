import type { ComponentType, SVGProps } from "react";
import {
  IconBuilding,
  IconCard,
  IconChart,
  IconClock,
  IconDashboard,
  IconEdit,
  IconInbox,
  IconNote,
  IconPeople,
  IconStore,
  IconUser,
  IconWallet,
} from "./icons";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Marks the item active for nested paths too (e.g. /employees/:id). */
  matchPrefix?: string;
  badgeKey?: "pendingCorrections" | "pendingAccessRequests";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Grouping mirrors the Dashboard/Employees reference sidebar. Managers are
// deliberately not a top-level entry — they're reached from Employees, the
// same place the mobile app keeps them.
export const organizationAdminNav: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: IconDashboard },
      { to: "/stores", label: "Stores", icon: IconStore, matchPrefix: "/stores" },
      { to: "/employees", label: "Employees", icon: IconPeople, matchPrefix: "/employees" },
      { to: "/employee-notes", label: "Employee notes", icon: IconNote },
    ],
  },
  {
    label: "Time",
    items: [
      { to: "/attendance", label: "Attendance", icon: IconClock },
      {
        to: "/attendance/corrections",
        label: "Corrections",
        icon: IconEdit,
        badgeKey: "pendingCorrections",
      },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/payroll", label: "Payroll", icon: IconCard },
      { to: "/payments", label: "Payments", icon: IconWallet },
      { to: "/reports/attendance", label: "Reports", icon: IconChart, matchPrefix: "/reports" },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        to: "/access-requests",
        label: "Access requests",
        icon: IconInbox,
        badgeKey: "pendingAccessRequests",
      },
      { to: "/organization", label: "Organization", icon: IconBuilding },
      { to: "/account", label: "Account", icon: IconUser },
    ],
  },
];

// Platform administration is a separate shell: none of the operational
// organization routes appear here, because none of them are things a
// SUPER_ADMIN is authorized to do.
export const superAdminNav: NavGroup[] = [
  {
    label: "Platform",
    items: [
      {
        to: "/super/organizations",
        label: "Organizations",
        icon: IconBuilding,
        matchPrefix: "/super/organizations",
      },
      { to: "/account", label: "Account", icon: IconUser },
    ],
  },
];
