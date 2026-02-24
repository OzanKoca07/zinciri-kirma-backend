import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SyncService } from "./sync.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Sync")
@ApiBearerAuth()
@Controller("v1/sync")
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private sync: SyncService) {}

  @Post("backup")
  backup(@Req() req: any, @Body() body: any) {
    return this.sync.backup(req.user.userId, body);
  }

  @Get("restore")
  restore(@Req() req: any) {
    return this.sync.restore(req.user.userId);
  }
}