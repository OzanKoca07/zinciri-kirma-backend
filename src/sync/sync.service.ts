import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  async backup(userId: string, payload: any) {
    // Keep latest backups. MVP: just insert.
    return this.prisma.syncBackup.create({
      data: { userId, payload },
      select: { id: true, createdAt: true },
    });
  }

  async restore(userId: string) {
    const latest = await this.prisma.syncBackup.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { payload: true, createdAt: true },
    });

    return latest ?? { payload: null, createdAt: null };
  }
}