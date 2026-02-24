import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecoveryService } from "../recovery/recovery.service";

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private recovery: RecoveryService,
  ) {}

  async rewardRecoveryPlus1(userId: string) {
    await this.prisma.rewardedEvent.create({
      data: { userId, rewardType: "RECOVERY_PLUS_1" }, // enum yerine string
    });

    return this.recovery.addTotal(userId, 1);
  }
}