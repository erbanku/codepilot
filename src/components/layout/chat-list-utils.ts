import { parseDBDate } from "@/lib/utils";
import type { ChatSession } from "@/types";
import type { TranslationKey } from "@/i18n";

const COLLAPSED_PROJECTS_KEY = "codepilot:collapsed-projects";
export const COLLAPSED_INITIALIZED_KEY = "codepilot:collapsed-initialized";

export function loadCollapsedProjects(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_PROJECTS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

export function saveCollapsedProjects(collapsed: Set<string>) {
  localStorage.setItem(COLLAPSED_PROJECTS_KEY, JSON.stringify([...collapsed]));
}

export interface ProjectGroup {
  workingDirectory: string;
  displayName: string;
  sessions: ChatSession[];
  latestUpdatedAt: number;
}

export function groupSessionsByProject(sessions: ChatSession[]): ProjectGroup[] {
  const map = new Map<string, ChatSession[]>();
  for (const session of sessions) {
    const key = session.working_directory || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(session);
  }

  const groups: ProjectGroup[] = [];
  for (const [wd, groupSessions] of map) {
    // Sort sessions within group by updated_at DESC
    groupSessions.sort(
      (a, b) =>
        parseDBDate(b.updated_at).getTime() - parseDBDate(a.updated_at).getTime()
    );
    const displayName =
      wd === ""
        ? "No Project"
        : groupSessions[0]?.project_name || wd.split("/").pop() || wd;
    const latestUpdatedAt = parseDBDate(groupSessions[0].updated_at).getTime();
    groups.push({
      workingDirectory: wd,
      displayName,
      sessions: groupSessions,
      latestUpdatedAt,
    });
  }

  // Sort groups by most recently active first
  groups.sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt);
  return groups;
}

export type TimeSection = "today" | "last7days" | "last30days" | "older";

export interface TimeSectionGroup {
  section: TimeSection;
  labelKey: TranslationKey;
  sessions: ChatSession[];
}

export function groupSessionsByTime(sessions: ChatSession[]): TimeSectionGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOf7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOf30Days = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

  const today: ChatSession[] = [];
  const last7Days: ChatSession[] = [];
  const last30Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    const updatedAt = parseDBDate(session.updated_at).getTime();
    if (updatedAt >= startOfToday.getTime()) {
      today.push(session);
    } else if (updatedAt >= startOf7Days.getTime()) {
      last7Days.push(session);
    } else if (updatedAt >= startOf30Days.getTime()) {
      last30Days.push(session);
    } else {
      older.push(session);
    }
  }

  const groups: TimeSectionGroup[] = [];
  if (today.length > 0) groups.push({ section: "today", labelKey: "chatList.timeSectionToday" as TranslationKey, sessions: today });
  if (last7Days.length > 0) groups.push({ section: "last7days", labelKey: "chatList.timeSectionLast7days" as TranslationKey, sessions: last7Days });
  if (last30Days.length > 0) groups.push({ section: "last30days", labelKey: "chatList.timeSectionLast30days" as TranslationKey, sessions: last30Days });
  if (older.length > 0) groups.push({ section: "older", labelKey: "chatList.timeSectionOlder" as TranslationKey, sessions: older });

  return groups;
}

export function formatRelativeTime(dateStr: string, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string {
  const date = parseDBDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return t('chatList.justNow');
  if (diffMin < 60) return t('chatList.minutesAgo', { n: diffMin });
  if (diffHr < 24) return t('chatList.hoursAgo', { n: diffHr });
  if (diffDay < 7) return t('chatList.daysAgo', { n: diffDay });
  return date.toLocaleDateString();
}
