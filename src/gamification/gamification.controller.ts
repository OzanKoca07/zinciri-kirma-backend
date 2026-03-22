import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { GamificationService } from "./gamification.service";

@ApiTags("Gamification")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("v1/gamification")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get("profile")
  getProfile(@Req() req: any) {
    return this.gamificationService.getProfile(req.user.userId);
  }

  @Get("statistics")
  getStatistics(@Req() req: any) {
    return this.gamificationService.getStatistics(req.user.userId);
  }
}