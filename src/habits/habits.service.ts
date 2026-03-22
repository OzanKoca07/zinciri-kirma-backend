import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import {
    calculateCurrentStreak,
    calculateLongestStreak,
    completedDaysInMonth,
    getLastNDaysSummary,
    isDoneToday,
} from "./streak.util";
import {
    HabitFrequency,
    HabitLogStatus,
    XpSourceType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHabitDto } from "./dto/create-habit.dto";
import { UpdateHabitDto } from "./dto/update-habit.dto";
import { CheckInDto } from "./dto/check-in.dto";
import { RecoveryService } from "../recovery/recovery.service";
import { LeaderboardService } from "../leaderboard/leaderboard.service";

@Injectable()
export class HabitsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly recoveryService: RecoveryService,
        private readonly leaderboardService: LeaderboardService,
    ) { }

    async create(userId: string, dto: CreateHabitDto) {
        return this.prisma.habit.create({
            data: {
                userId,
                title: dto.title,
                emoji: dto.emoji,
                color: dto.color,
                frequency: this.mapFrequency(dto.frequency),
                reminderEnabled: dto.reminderEnabled ?? false,
                targetValue: dto.goal ?? 1,
            },
        });
    }

    async findAll(userId: string) {
        const habits = await this.prisma.habit.findMany({
            where: {
                userId,
                isArchived: false,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                logs: {
                    orderBy: { logDate: "desc" },
                },
            },
        });

        return habits.map((habit) => ({
            ...habit,
            stats: {
  currentStreak: calculateCurrentStreak(
    habit.logs,
    habit.frequency,
    new Date(),
    habit.createdAt,
  ),
  longestStreak: calculateLongestStreak(
    habit.logs,
    habit.frequency,
  ),
  completedThisMonth: completedDaysInMonth(
    habit.logs,
    new Date(),
    habit.frequency,
  ),
  doneToday: isDoneToday(
    habit.logs,
    new Date(),
    habit.frequency,
  ),
  last7Days: getLastNDaysSummary(
    habit.logs,
    7,
    new Date(),
    habit.frequency,
  ),
},
        }));
    }

    async findOne(userId: string, habitId: string) {
        const habit = await this.prisma.habit.findUnique({
            where: { id: habitId },
            include: {
                logs: {
                    orderBy: { logDate: "desc" },
                },
            },
        });

        if (!habit) {
            throw new NotFoundException("Habit not found");
        }

        if (habit.userId !== userId) {
            throw new ForbiddenException("You cannot access this habit");
        }

        return {
            ...habit,
            stats: {
  currentStreak: calculateCurrentStreak(
    habit.logs,
    habit.frequency,
    new Date(),
    habit.createdAt,
  ),
  longestStreak: calculateLongestStreak(
    habit.logs,
    habit.frequency,
  ),
  completedThisMonth: completedDaysInMonth(
    habit.logs,
    new Date(),
    habit.frequency,
  ),
  doneToday: isDoneToday(
    habit.logs,
    new Date(),
    habit.frequency,
  ),
  last7Days: getLastNDaysSummary(
    habit.logs,
    7,
    new Date(),
    habit.frequency,
  ),
},
        };
    }

    async update(userId: string, habitId: string, dto: UpdateHabitDto) {
        await this.ensureHabitOwner(userId, habitId);

        return this.prisma.habit.update({
            where: { id: habitId },
            data: {
                title: dto.title,
                emoji: dto.emoji,
                color: dto.color,
                frequency: dto.frequency
                    ? this.mapFrequency(dto.frequency)
                    : undefined,
                reminderEnabled: dto.reminderEnabled,
                targetValue: dto.goal,
            },
        });
    }

    async archive(userId: string, habitId: string) {
        await this.ensureHabitOwner(userId, habitId);

        return this.prisma.habit.update({
            where: { id: habitId },
            data: {
                isArchived: true,
            },
        });
    }

    async checkIn(userId: string, habitId: string, dto: CheckInDto) {
    const habit = await this.ensureHabitOwner(userId, habitId);

    const baseDate = new Date(dto.date);
    if (Number.isNaN(baseDate.getTime())) {
        throw new BadRequestException("Gecersiz tarih");
    }
    baseDate.setHours(0, 0, 0, 0);

    const periodDate = this.getPeriodStart(
        baseDate,
        habit.frequency,
        habit.createdAt,
    );

    const result = await this.prisma.$transaction(async (tx) => {
        const existingLog = await tx.habitLog.findUnique({
            where: {
                habitId_logDate: {
                    habitId,
                    logDate: periodDate,
                },
            },
        });

        let finalStatus = dto.status;
        let earnedXp = 0;

        if (dto.status === HabitLogStatus.MISSED && dto.useRecovery) {
            const wallet = await this.recoveryService.getWallet(userId);
            const remaining = wallet.total - wallet.used;

            if (remaining <= 0) {
                throw new BadRequestException("No recovery rights left");
            }

            await this.recoveryService.useOne(userId);

            finalStatus = HabitLogStatus.DONE;
            earnedXp = 10;

            const savedRecoveredLog = await tx.habitLog.upsert({
                where: {
                    habitId_logDate: {
                        habitId,
                        logDate: periodDate,
                    },
                },
                update: {
                    status: finalStatus,
                    progress: habit.targetValue,
                    earnedXp,
                    lastProgressDate:
                        habit.frequency === HabitFrequency.WEEKLY ||
                        habit.frequency === HabitFrequency.CUSTOM
                            ? baseDate
                            : existingLog?.lastProgressDate,
                },
                create: {
                    habitId,
                    userId,
                    logDate: periodDate,
                    status: finalStatus,
                    progress: habit.targetValue,
                    earnedXp,
                    lastProgressDate:
                        habit.frequency === HabitFrequency.WEEKLY ||
                        habit.frequency === HabitFrequency.CUSTOM
                            ? baseDate
                            : undefined,
                },
            });

            if (earnedXp > 0) {
                await tx.xpEvent.create({
                    data: {
                        userId,
                        sourceType: XpSourceType.HABIT_COMPLETE,
                        sourceId: savedRecoveredLog.id,
                        amount: earnedXp,
                    },
                });
            }

            return savedRecoveredLog;
        }

        const increment = Math.max(dto.progress ?? 1, 1);
        const currentProgress = existingLog?.progress ?? 0;

        if (currentProgress >= habit.targetValue) {
            throw new BadRequestException("Bu period icin hedef zaten tamamlandi");
        }

        if (
            existingLog &&
            (habit.frequency === HabitFrequency.WEEKLY ||
                habit.frequency === HabitFrequency.CUSTOM) &&
            existingLog.lastProgressDate
        ) {
            const lastProgressDate = new Date(existingLog.lastProgressDate);
            lastProgressDate.setHours(0, 0, 0, 0);

            if (lastProgressDate.getTime() === baseDate.getTime()) {
                throw new BadRequestException(
                    "Bu aliskanlik icin bugun zaten ilerleme kaydedildi",
                );
            }
        }

        const nextProgress = Math.min(
            currentProgress + increment,
            habit.targetValue,
        );

        finalStatus =
            nextProgress >= habit.targetValue
                ? HabitLogStatus.DONE
                : HabitLogStatus.PARTIAL;

        if (
            finalStatus === HabitLogStatus.DONE &&
            existingLog?.status !== HabitLogStatus.DONE
        ) {
            earnedXp = 20;
        }

        const savedLog = await tx.habitLog.upsert({
            where: {
                habitId_logDate: {
                    habitId,
                    logDate: periodDate,
                },
            },
            update: {
                status: finalStatus,
                progress: nextProgress,
                earnedXp: (existingLog?.earnedXp ?? 0) + earnedXp,
                lastProgressDate:
                    habit.frequency === HabitFrequency.WEEKLY ||
                    habit.frequency === HabitFrequency.CUSTOM
                        ? baseDate
                        : existingLog?.lastProgressDate,
            },
            create: {
                habitId,
                userId,
                logDate: periodDate,
                status: finalStatus,
                progress: nextProgress,
                earnedXp,
                lastProgressDate:
                    habit.frequency === HabitFrequency.WEEKLY ||
                    habit.frequency === HabitFrequency.CUSTOM
                        ? baseDate
                        : undefined,
            },
        });

        if (earnedXp > 0) {
            await tx.xpEvent.create({
                data: {
                    userId,
                    sourceType: XpSourceType.HABIT_COMPLETE,
                    sourceId: savedLog.id,
                    amount: earnedXp,
                },
            });
        }

        return savedLog;
    });

    const allLogs = await this.prisma.habitLog.findMany({
        where: {
            habitId,
            userId,
        },
        orderBy: {
            logDate: "desc",
        },
    });

    await this.leaderboardService.refreshUserLeaderboards(userId);

    return {
        message: "Check-in saved",
        log: result,
        stats: {
  currentStreak: calculateCurrentStreak(
    allLogs,
    habit.frequency,
    new Date(),
    habit.createdAt,
  ),
  longestStreak: calculateLongestStreak(
    allLogs,
    habit.frequency,
  ),
  completedThisMonth: completedDaysInMonth(
    allLogs,
    new Date(),
    habit.frequency,
  ),
  doneToday: isDoneToday(
    allLogs,
    new Date(),
    habit.frequency,
  ),
  last7Days: getLastNDaysSummary(
    allLogs,
    7,
    new Date(),
    habit.frequency,
  ),
},
    };
}

    async getCalendar(userId: string, habitId: string, month: string) {
        await this.ensureHabitOwner(userId, habitId);

        const [year, mon] = month.split("-").map(Number);

        if (!year || !mon) {
            throw new BadRequestException("Month must be in YYYY-MM format");
        }

        const start = new Date(year, mon - 1, 1);
        const end = new Date(year, mon, 1);

        const logs = await this.prisma.habitLog.findMany({
            where: {
                habitId,
                userId,
                logDate: {
                    gte: start,
                    lt: end,
                },
            },
            orderBy: {
                logDate: "asc",
            },
        });

        return {
            month,
            logs,
        };
    }

    private async ensureHabitOwner(userId: string, habitId: string) {
        const habit = await this.prisma.habit.findUnique({
            where: { id: habitId },
        });

        if (!habit) {
            throw new NotFoundException("Habit not found");
        }

        if (habit.userId !== userId) {
            throw new ForbiddenException("You cannot access this habit");
        }

        return habit;
    }

    private getPeriodStart(
        date: Date,
        frequency: HabitFrequency,
        habitCreatedAt?: Date,
    ): Date {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);

        if (frequency === HabitFrequency.DAILY) {
            return d;
        }

        if (frequency === HabitFrequency.WEEKLY) {
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            d.setDate(d.getDate() + diff);
            d.setHours(0, 0, 0, 0);
            return d;
        }

        if (frequency === HabitFrequency.CUSTOM) {
    if (!habitCreatedAt) {
        throw new Error("habitCreatedAt is required for CUSTOM frequency");
    }

    const anchor = new Date(habitCreatedAt);
    anchor.setHours(0, 0, 0, 0);

    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    const diffMs = current.getTime() - anchor.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const cycleLength = 30;
    const cycleIndex = Math.floor(Math.max(diffDays, 0) / cycleLength);

    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + cycleIndex * cycleLength);
    periodStart.setHours(0, 0, 0, 0);

    return periodStart;
}

        return d;
    }
    private mapFrequency(
        frequency: "daily" | "weekly" | "custom",
    ): HabitFrequency {
        switch (frequency) {
            case "daily":
                return HabitFrequency.DAILY;
            case "weekly":
                return HabitFrequency.WEEKLY;
            case "custom":
                return HabitFrequency.CUSTOM;
            default:
                throw new BadRequestException("Invalid frequency");
        }
    }
}