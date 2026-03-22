import { Module } from "@nestjs/common";
import { GamificationController } from "./gamification.controller";
import { GamificationService } from "./gamification.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RecoveryModule } from "../recovery/recovery.module";

@Module({
  imports: [PrismaModule, RecoveryModule],
  controllers: [GamificationController],
  providers: [GamificationService],
})
export class GamificationModule {}