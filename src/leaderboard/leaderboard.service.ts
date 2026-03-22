import { BadRequestException, Injectable } from "@nestjs/common";
import { HabitLogStatus, LeaderboardPeriod } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(
    currentUserId: string,
    period: "weekly" | "monthly" | "all_time",
  ) {
    const periodType = this.mapPeriod(period);
    const periodKey = this.getPeriodKey(periodType);

    const entries = await this.prisma.leaderboardEntry.findMany({
      where: {
        periodType,
        periodKey,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { score: "desc" },
        { totalXp: "desc" },
        { updatedAt: "asc" },
      ],
    });

    const ranked = entries.map((entry, index) => ({
      id: entry.user.id,
      name: entry.user.name,
      rank: index + 1,
      xp: entry.totalXp,
      streak: entry.streak,
      level: entry.level,
      badges: entry.badgeCount,
      isMe: entry.user.id === currentUserId,
    }));

    return {
      period,
      periodKey,
      topUsers: ranked.slice(0, 3),
      listUsers: ranked.slice(3),
      currentUser: ranked.find((item) => item.id === currentUserId) ?? null,
      totalUsers: ranked.length,
    };
  }

  async rebuildLeaderboard(period: "weekly" | "monthly" | "all_time") {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      await this.upsertUserEntryForPeriod(user.id, period);
    }

    return {
      success: true,
      period,
      message: "Leaderboard rebuilt successfully",
    };
  }

  async refreshUserLeaderboards(userId: string) {
    await Promise.all([
      this.upsertUserEntryForPeriod(userId, "weekly"),
      this.upsertUserEntryForPeriod(userId, "monthly"),
      this.upsertUserEntryForPeriod(userId, "all_time"),
    ]);

    return { success: true };
  }

  private async upsertUserEntryForPeriod(
    userId: string,
    period: "weekly" | "monthly" | "all_time",
  ) {
    const periodType = this.mapPeriod(period);
    const periodKey = this.getPeriodKey(periodType);
    const startDate = this.getPeriodStartDate(periodType);
    const endDate = new Date();

    const [xpAgg, badgeCount, doneLogs] = await Promise.all([
      this.prisma.xpEvent.aggregate({
        where: this.buildXpWhere(userId, periodType, startDate, endDate),
        _sum: {
          amount: true,
        },
      }),

      this.prisma.userBadge.count({
        where: {
          userId,
        },
      }),

      this.prisma.habitLog.findMany({
        where: this.buildHabitLogWhere(userId, periodType, startDate, endDate),
        orderBy: {
          logDate: "asc",
        },
      }),
    ]);

    const totalXp = xpAgg._sum.amount ?? 0;
    const streak = this.calculateLeaderboardStreak(doneLogs, periodType);
    const level = Math.floor(totalXp / 300) + 1;
    const score = totalXp + streak * 25 + badgeCount * 50;

    return this.prisma.leaderboardEntry.upsert({
      where: {
        userId_periodType_periodKey: {
          userId,
          periodType,
          periodKey,
        },
      },
      update: {
        score,
        totalXp,
        streak,
        badgeCount,
        level,
      },
      create: {
        userId,
        periodType,
        periodKey,
        score,
        totalXp,
        streak,
        badgeCount,
        level,
      },
    });
  }

  private mapPeriod(period: "weekly" | "monthly" | "all_time"): LeaderboardPeriod {
    switch (period) {
      case "weekly":
        return LeaderboardPeriod.WEEKLY;
      case "monthly":
        return LeaderboardPeriod.MONTHLY;
      case "all_time":
        return LeaderboardPeriod.ALL_TIME;
      default:
        throw new BadRequestException("Invalid leaderboard period");
    }
  }

  private getPeriodKey(periodType: LeaderboardPeriod) {
    const now = new Date();

    if (periodType === LeaderboardPeriod.ALL_TIME) {
      return "all-time";
    }

    if (periodType === LeaderboardPeriod.MONTHLY) {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }

    const startOfWeek = this.getStartOfWeek(now);
    const year = startOfWeek.getFullYear();
    const month = String(startOfWeek.getMonth() + 1).padStart(2, "0");
    const day = String(startOfWeek.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getPeriodStartDate(periodType: LeaderboardPeriod) {
    const now = new Date();

    if (periodType === LeaderboardPeriod.ALL_TIME) {
      return null;
    }

    if (periodType === LeaderboardPeriod.MONTHLY) {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return this.getStartOfWeek(now);
  }

  private buildXpWhere(
    userId: string,
    periodType: LeaderboardPeriod,
    startDate: Date | null,
    endDate: Date,
  ) {
    if (periodType === LeaderboardPeriod.ALL_TIME || !startDate) {
      return { userId };
    }

    return {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };
  }

  private buildHabitLogWhere(
    userId: string,
    periodType: LeaderboardPeriod,
    startDate: Date | null,
    endDate: Date,
  ) {
    if (periodType === LeaderboardPeriod.ALL_TIME || !startDate) {
      return {
        userId,
        status: HabitLogStatus.DONE,
      };
    }

    return {
      userId,
      status: HabitLogStatus.DONE,
      logDate: {
        gte: startDate,
        lte: endDate,
      },
    };
  }

  private calculateLeaderboardStreak(
    logs: Array<{ logDate: Date; status: HabitLogStatus }>,
    periodType: LeaderboardPeriod,
  ) {
    if (logs.length === 0) return 0;

    const uniqueDays = Array.from(
      new Set(
        logs.map((log) => {
          const d = new Date(log.logDate);
          d.setHours(0, 0, 0, 0);
          return d.toISOString().slice(0, 10);
        }),
      ),
    ).sort();

    if (periodType === LeaderboardPeriod.WEEKLY) {
      return uniqueDays.length;
    }

    if (periodType === LeaderboardPeriod.MONTHLY) {
      return uniqueDays.length;
    }

    return uniqueDays.length;
  }

  private getStartOfWeek(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }
}