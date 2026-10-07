export type OperationalTask = {
  id: string;
  title: string;
  notes: string;
  ownerId: string;
  competitionId: string | null;
  category: "sport" | "editorial" | "brand" | "organization";
  priority: "low" | "medium" | "high";
  dueAtMs: number;
  status: "open" | "done" | "archived";
  revision: number;
  reminderMinutes: number[];
  pushEnabled: boolean;
  repeat: "none" | "weekly";
  createdAtMs: number;
  updatedAtMs: number;
  completedAtMs?: number;
};
export type OperationalSuggestion = {
  id: string;
  kind: "fact" | "experiment";
  title: string;
  reason: string;
  actionUrl?: string;
  metric?: string;
  taskTitle?: string;
  dueAtMs?: number;
};
export type OperationsConnections = {
  website: { status: "not_configured" | "needs_verification"; message: string };
  instagram: {
    status: "not_configured" | "needs_verification";
    message: string;
  };
  assistant: { status: "not_configured" | "configured"; message: string };
};
