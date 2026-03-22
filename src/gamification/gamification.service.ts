import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecoveryService } from "../recovery/recovery.service";
import {
  calculateCurrentStreak,
  calculateLongestStreak,
} from "../habits/streak.util";
import { HabitFrequency, HabitLogStatus } from "@prisma/client";

@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recoveryService: RecoveryService,
  ) { }

  async getProfile(userId: string) {
    const [user, xpAgg, badgeCount, doneLogs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
        },
      }),

      this.prisma.xpEvent.aggregate({
        where: { userId },
        _sum: {
          amount: true,
        },
      }),

      this.prisma.userBadge.count({
        where: { userId },
      }),

      this.prisma.habitLog.findMany({
        where: {
          userId,
          status: "DONE",
        },
        select: {
          logDate: true,
          status: true,
          habitId: true,
        },
      }),
    ]);

    const wallet = await this.recoveryService.getWallet(userId);

    const totalXp = xpAgg._sum.amount ?? 0;
    const level = this.calculateLevel(totalXp);

    const currentStreak = this.calculateGlobalCurrentStreak(doneLogs);
    const longestStreak = this.calculateGlobalLongestStreak(doneLogs);

    return {
      userId: user?.id ?? userId,
      name: user?.name ?? "User",
      totalXp,
      level,
      currentStreak,
      longestStreak,
      completedDays: this.uniqueDailyDoneLogs(doneLogs).length,
      badgeCount,
      recoveryRemaining: wallet.total - wallet.used,
    };
  }

  async getStatistics(userId: string) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const last7DaysStart = new Date(startOfToday);
    last7DaysStart.setDate(startOfToday.getDate() - 6);

    const [
      habits,
      xpEvents,
      badgeCount,
      doneLogs,
      recentLogs,
    ] = await Promise.all([
      this.prisma.habit.findMany({
        where: {
          userId,
          isArchived: false,
        },
        include: {
          logs: {
            orderBy: {
              logDate: "asc",
            },
          },
        },
      }),

      this.prisma.xpEvent.findMany({
        where: { userId },
        orderBy: {
          createdAt: "asc",
        },
      }),

      this.prisma.userBadge.count({
        where: { userId },
      }),

      this.prisma.habitLog.findMany({
        where: {
          userId,
          status: HabitLogStatus.DONE,
        },
        orderBy: {
          logDate: "asc",
        },
      }),

      this.prisma.habitLog.findMany({
        where: {
          userId,
          logDate: {
            gte: last7DaysStart,
          },
        },
        orderBy: {
          logDate: "asc",
        },
      }),
    ]);

    const totalXp = xpEvents.reduce((sum, item) => sum + item.amount, 0);
    const level = this.calculateLevel(totalXp);
    const currentLevelBaseXp = (level - 1) * 300;
    const nextLevelXp = 300;
    const currentLevelXp = totalXp - currentLevelBaseXp;

    const totalCompletedDays = this.uniqueDailyDoneLogs(doneLogs).length;
    const bestStreak = this.calculateGlobalLongestStreak(doneLogs);

    const completionRate = this.calculateCompletionRate(habits, now);

    const weeklyBars = this.buildWeeklyBars(recentLogs, now);
    const streakHistory = this.buildStreakHistory(doneLogs);

    return {
      totalXp,
      level,
      currentLevelXp,
      nextLevelXp,
      badgeCount,
      totalCompletedDays,
      bestStreak,
      completionRate,
      weeklyBars,
      streakHistory,
    };
  }

  private calculateLevel(totalXp: number) {
    return Math.floor(totalXp / 300) + 1;
  }
  private toLocalDateKey(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private calculateGlobalCurrentStreak(
    logs: Array<{ logDate: Date; status: string }>,
  ) {
    const uniqueLogs = this.uniqueDailyDoneLogs(logs);
    return calculateCurrentStreak(uniqueLogs, HabitFrequency.DAILY);
  }

  private calculateGlobalLongestStreak(
    logs: Array<{ logDate: Date; status: string }>,
  ) {
    const uniqueLogs = this.uniqueDailyDoneLogs(logs);
    return calculateLongestStreak(uniqueLogs, HabitFrequency.DAILY);
  }

  private uniqueDailyDoneLogs(logs: Array<{ logDate: Date; status: string }>) {
    const map = new Map<string, { logDate: Date; status: "DONE" }>();

    for (const log of logs) {
      if (log.status !== "DONE") continue;

      const date = new Date(log.logDate);
      date.setHours(0, 0, 0, 0);
      const key = this.toLocalDateKey(date);

      if (!map.has(key)) {
        map.set(key, {
          logDate: date,
          status: HabitLogStatus.DONE,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => a.logDate.getTime() - b.logDate.getTime(),
    );
  }

  private calculateCompletionRate(
  habits: Array<{
    logs: Array<{ logDate: Date; status: HabitLogStatus }>;
  }>,
  today: Date,
) {
  const start = this.addDays(today, -6);
  start.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const doneSet = new Set<string>();

  for (const habit of habits) {
    for (const log of habit.logs) {
      const d = new Date(log.logDate);
      if (
        log.status === HabitLogStatus.DONE &&
        d >= start &&
        d <= end
      ) {
        const key = this.toLocalDateKey(d);
        doneSet.add(key);
      }
    }
  }

  return Math.round((doneSet.size / 7) * 100);
}

  private buildWeeklyBars(
    logs: Array<{ logDate: Date; status: HabitLogStatus }>,
    today: Date,
  ) {
    const labels = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
    const result = labels.map((label) => ({
      label,
      value: 0,
    }));

    const start = this.addDays(today, -6);
    start.setHours(0, 0, 0, 0);

    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    for (const log of logs) {
      const d = new Date(log.logDate);

      if (
        log.status === HabitLogStatus.DONE &&
        d >= start &&
        d <= end
      ) {
        const dayIndex = d.getDay();
        result[dayIndex].value += 1;
      }
    }

    const maxValue = Math.max(...result.map((item) => item.value), 1);

    return result.map((item) => ({
      ...item,
      value: Math.round((item.value / maxValue) * 100),
    }));
  }

  private buildStreakHistory(
    doneLogs: Array<{ logDate: Date; status: HabitLogStatus }>,
  ) {
    const uniqueLogs = this.uniqueDailyDoneLogs(doneLogs);

    if (uniqueLogs.length === 0) {
      return [0, 0, 0, 0, 0, 0, 0];
    }

    const history: number[] = [];
    let current = 0;
    let prevDate: Date | null = null;

    for (const log of uniqueLogs) {
      const currentDate = new Date(log.logDate);
      currentDate.setHours(0, 0, 0, 0);

      if (!prevDate) {
        current = 1;
      } else {
        const diff =
          (currentDate.getTime() - prevDate.getTime()) /
          (1000 * 60 * 60 * 24);

        if (diff === 1) {
          current += 1;
        } else {
          current = 1;
        }
      }

      history.push(current);
      prevDate = currentDate;
    }

    return history.slice(-7);
  }

  private addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
}