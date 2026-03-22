import { Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LeaderboardService } from "./leaderboard.service";

@ApiTags("Leaderboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("v1/leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(
    @Req() req: any,
    @Query("period") period?: "weekly" | "monthly" | "all_time",
  ) {
    return this.leaderboardService.getLeaderboard(
      req.user.userId,
      period ?? "weekly",
    );
  }

  @Post("rebuild")
  rebuildLeaderboard(
    @Query("period") period?: "weekly" | "monthly" | "all_time",
  ) {
    return this.leaderboardService.rebuildLeaderboard(period ?? "weekly");
  }
}