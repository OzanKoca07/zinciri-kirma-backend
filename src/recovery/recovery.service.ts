import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { monthKey } from "./recovery.util";

@Injectable()
export class RecoveryService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string, month = monthKey()) {
    const wallet = await this.prisma.recoveryWallet.upsert({
      where: { userId_month: { userId, month } },
      update: {},
      create: { userId, month, total: 2, used: 0 },
    });
    return wallet;
  }

  async useOne(userId: string, month = monthKey()) {
    const wallet = await this.getWallet(userId, month);
    if (wallet.used >= wallet.total) throw new BadRequestException("No recovery rights left");

    return this.prisma.recoveryWallet.update({
      where: { id: wallet.id },
      data: { used: { increment: 1 } },
    });
  }

  async addTotal(userId: string, plus: number, month = monthKey()) {
    const wallet = await this.getWallet(userId, month);
    return this.prisma.recoveryWallet.update({
      where: { id: wallet.id },
      data: { total: { increment: plus } },
    });
  }
}