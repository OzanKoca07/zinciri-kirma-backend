import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  constructor() {
    super({
      adapter: new PrismaPg(PrismaService.pool),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    // pool'u kapatma: uygulama boyunca kullanilsin
  }
}