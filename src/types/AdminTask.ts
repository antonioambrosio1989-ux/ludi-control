export type AdminTaskPriority = "low" | "medium" | "high";

export type AdminTaskCategory =
  | "matches"
  | "news"
  | "awards"
  | "polls"
  | "calendar";

export type AdminTask = {
  id: string;
  title: string;
  description?: string;

  priority: AdminTaskPriority;
  category: AdminTaskCategory;

  dueLabel?: string;

  actionLabel: string;
  actionUrl: string;

  completed: boolean;
};

export type AdminActivity = {
  id: string;
  title: string;
  timeLabel: string;
};