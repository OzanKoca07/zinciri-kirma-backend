import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RecoveryService } from "./recovery.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Recovery")
@ApiBearerAuth()
@Controller("v1/recovery")
@UseGuards(JwtAuthGuard)
export class RecoveryController {
  constructor(private recovery: RecoveryService) {}

  @Get("wallet")
  wallet(@Req() req: any) {
    return this.recovery.getWallet(req.user.userId);
  }

  @Post("use")
  use(@Req() req: any) {
    return this.recovery.useOne(req.user.userId);
  }
}