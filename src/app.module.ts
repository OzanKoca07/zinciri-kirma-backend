import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { SyncModule } from "./sync/sync.module";
import { RecoveryModule } from "./recovery/recovery.module";
import { AdsModule } from "./ads/ads.module";
import { HealthController } from "./health/health.controller";
import { HabitsModule } from "./habits/habits.module";
import { GamificationModule } from "./gamification/gamification.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SyncModule,
    RecoveryModule,
    AdsModule,
    HabitsModule,
    LeaderboardModule,
    GamificationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}