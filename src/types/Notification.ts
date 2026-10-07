/*
 * ============================================================
 * NOTIFICATION TYPES
 * ============================================================
 */

export type NotificationCategory =
  | "matchday"
  | "matchReports"
  | "ludisWeek"
  | "calendar";

export type NotificationPreferences = {
  matchday:
    boolean;

  matchReports:
    boolean;

  ludisWeek:
    boolean;

  calendar:
    boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES:
  NotificationPreferences = {
    matchday:
      true,

    matchReports:
      true,

    ludisWeek:
      true,

    calendar:
      true,
  };
