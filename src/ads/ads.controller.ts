import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdsService } from "./ads.service";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
@ApiTags("Ads")
@ApiBearerAuth()
@Controller("v1/ads")
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(private ads: AdsService) {}

  @Post("reward")
  reward(@Req() req: any, @Body() body: any) {
    // MVP: only recovery reward supported
    if (body?.rewardType !== "RECOVERY_PLUS_1") {
      return { ok: false, message: "Unsupported rewardType" };
    }
    return this.ads.rewardRecoveryPlus1(req.user.userId);
  }
}