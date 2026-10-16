import type { Employee, Project, Assignment, TimeEntry } from "../types";

// Dane testowe — do wymiany na realny import z Firestore/Dataverse później.
// Hierarchia: Admin > Planning, PM > Supervisor > Worker/TeamLeader (ten sam poziom)

export const seedEmployees: Employee[] = [
  { id: "admin-1", name: "Administrator", role: "ADMIN" },
  { id: "planning-1", name: "Ola Planista", role: "PLANNING" },

  { id: "pm-1", name: "Marek PM", role: "PM" },
  { id: "pm-2", name: "Kasia PM", role: "PM" },

  { id: "sv-1", name: "Tomasz Supervisor", role: "SUPERVISOR" },
  { id: "sv-2", name: "Piotr Supervisor", role: "SUPERVISOR" },

  { id: "w-1", name: "Jan Sosnowski", role: "WORKER", trade: "ELECTRICIAN" },
  { id: "w-2", name: "Damian Szendera", role: "WORKER", trade: "ELECTRICIAN" },
  { id: "w-3", name: "Sebastian Wnęk", role: "WORKER", trade: "MECHANIC" },
  { id: "w-4", name: "Adam Kowalski", role: "WORKER", trade: "MECHANIC" },
];

export const seedProjects: Project[] = [
  {
    id: "proj-1",
    name: "P26060-Moffett-Wrexham-UK",
    customerName: "Moffett Automated Storage",
    siteAddress: "Ash Rd South, Wrexham Ind Estate, Wrexham, LL13 9UG",
    pmId: "pm-1",
    supervisorIds: ["sv-1"],
    status: "ACTIVE",
  },
  {
    id: "proj-2",
    name: "P26071-Acme-Logistics-DE",
    customerName: "Acme Logistics GmbH",
    siteAddress: "Industriestrasse 12, 50667 Köln",
    pmId: "pm-1",
    supervisorIds: ["sv-2"],
    status: "ACTIVE",
  },
];

export const seedAssignments: Assignment[] = [
  { id: "a-1", projectId: "proj-1", employeeId: "w-1", trade: "ELECTRICIAN" },
  { id: "a-2", projectId: "proj-1", employeeId: "w-2", trade: "ELECTRICIAN" },
  { id: "a-3", projectId: "proj-1", employeeId: "w-3", trade: "MECHANIC" },
  { id: "a-4", projectId: "proj-2", employeeId: "w-4", trade: "MECHANIC" },
];

export const seedTimeEntries: TimeEntry[] = [
  {
    id: "te-1",
    employeeId: "w-1",
    projectId: "proj-1",
    date: "2026-10-13",
    workStart: "07:00",
    workEnd: "18:00",
    breakMinutes: 60,
    status: "SUBMITTED",
  },
  {
    id: "te-2",
    employeeId: "w-2",
    projectId: "proj-1",
    date: "2026-10-13",
    workStart: "07:00",
    workEnd: "18:00",
    breakMinutes: 60,
    status: "SUBMITTED",
  },
];
