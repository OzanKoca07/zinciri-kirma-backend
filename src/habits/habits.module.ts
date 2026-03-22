import { Module } from "@nestjs/common";
import { HabitsController } from "./habits.controller";
import { HabitsService } from "./habits.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RecoveryModule } from "../recovery/recovery.module";
import { LeaderboardModule } from "../leaderboard/leaderboard.module";
@Module({
  imports: [PrismaModule, RecoveryModule, LeaderboardModule],
  controllers: [HabitsController],
  providers: [HabitsService],
})
export class HabitsModule {}