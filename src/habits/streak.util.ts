import { HabitFrequency, HabitLogStatus } from "@prisma/client";

type MinimalHabitLog = {
  logDate: Date;
  status: HabitLogStatus;
  createdAt?: Date;
  lastProgressDate?: Date | null;
};

function toDateOnly(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toKey(date: Date): string {
  const d = toDateOnly(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addCustomPeriods(date: Date, periods: number): Date {
  return addDays(date, periods * 30);
}

function getStartOfWeek(date: Date): Date {
  const d = toDateOnly(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date: Date): string {
  return toKey(getStartOfWeek(date));
}

function getCustomPeriodStart(date: Date, habitCreatedAt?: Date): Date {
  const current = toDateOnly(date);

  if (!habitCreatedAt) {
    return current;
  }

  const anchor = toDateOnly(habitCreatedAt);
  const diffMs = current.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cycleLength = 30;
  const cycleIndex = Math.floor(Math.max(diffDays, 0) / cycleLength);

  const periodStart = new Date(anchor);
  periodStart.setDate(anchor.getDate() + cycleIndex * cycleLength);
  periodStart.setHours(0, 0, 0, 0);

  return periodStart;
}

function getActivityDate(
  log: MinimalHabitLog,
  frequency: HabitFrequency,
): Date {
  if (frequency === HabitFrequency.DAILY) {
    return new Date(log.logDate);
  }

  return new Date(log.lastProgressDate ?? log.createdAt ?? log.logDate);
}

export function calculateCurrentStreak(
  logs: MinimalHabitLog[],
  frequency: HabitFrequency,
  today = new Date(),
  habitCreatedAt?: Date,
): number {
  const doneLogs = logs.filter((log) => log.status === HabitLogStatus.DONE);

  if (doneLogs.length === 0) return 0;

  if (frequency === HabitFrequency.DAILY) {
    const doneSet = new Set(doneLogs.map((log) => toKey(log.logDate)));
    let streak = 0;
    let cursor = toDateOnly(today);

    while (doneSet.has(toKey(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    return streak;
  }

  if (frequency === HabitFrequency.WEEKLY) {
    const doneSet = new Set(doneLogs.map((log) => getWeekKey(log.logDate)));
    let streak = 0;
    let cursor = getStartOfWeek(today);

    while (doneSet.has(getWeekKey(cursor))) {
      streak++;
      cursor = addWeeks(cursor, -1);
    }

    return streak;
  }

  const doneSet = new Set(doneLogs.map((log) => toKey(log.logDate)));
  let streak = 0;
  let cursor = getCustomPeriodStart(today, habitCreatedAt);

  while (doneSet.has(toKey(cursor))) {
    streak++;
    cursor = addCustomPeriods(cursor, -1);
  }

  return streak;
}

export function calculateLongestStreak(
  logs: MinimalHabitLog[],
  frequency: HabitFrequency,
): number {
  const doneLogs = logs.filter((log) => log.status === HabitLogStatus.DONE);
  if (doneLogs.length === 0) return 0;

  if (frequency === HabitFrequency.DAILY) {
    const keys = Array.from(
      new Set(doneLogs.map((log) => toKey(log.logDate))),
    ).sort();

    let longest = 1;
    let current = 1;

    for (let i = 1; i < keys.length; i++) {
      const prev = new Date(keys[i - 1]);
      const curr = new Date(keys[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }

  if (frequency === HabitFrequency.WEEKLY) {
    const keys = Array.from(
      new Set(doneLogs.map((log) => getWeekKey(log.logDate))),
    ).sort();

    let longest = 1;
    let current = 1;

    for (let i = 1; i < keys.length; i++) {
      const prev = new Date(keys[i - 1]);
      const curr = new Date(keys[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24 * 7);

      if (diff === 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }

    return longest;
  }

  const keys = Array.from(
    new Set(doneLogs.map((log) => toKey(log.logDate))),
  ).sort();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const curr = new Date(keys[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 30) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function completedDaysInMonth(
  logs: MinimalHabitLog[],
  targetDate = new Date(),
  frequency: HabitFrequency = HabitFrequency.DAILY,
): number {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();

  const keys = new Set(
    logs
      .filter((log) => log.status === HabitLogStatus.DONE)
      .map((log) => getActivityDate(log, frequency))
      .filter((date) => date.getFullYear() === year && date.getMonth() === month)
      .map((date) => toKey(date)),
  );

  return keys.size;
}

export function isDoneToday(
  logs: MinimalHabitLog[],
  today = new Date(),
  frequency: HabitFrequency = HabitFrequency.DAILY,
): boolean {
  const todayKey = toKey(today);

  return logs.some((log) => {
    if (log.status !== HabitLogStatus.DONE) return false;
    return toKey(getActivityDate(log, frequency)) === todayKey;
  });
}

export function getLastNDaysSummary(
  logs: MinimalHabitLog[],
  n = 7,
  today = new Date(),
  frequency: HabitFrequency = HabitFrequency.DAILY,
) {
  const doneSet = new Set(
    logs
      .filter((log) => log.status === HabitLogStatus.DONE)
      .map((log) => toKey(getActivityDate(log, frequency))),
  );

  const result: Array<{ date: string; done: boolean }> = [];

  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(toDateOnly(today), -i);
    const key = toKey(date);

    result.push({
      date: key,
      done: doneSet.has(key),
    });
  }

  return result;
}