import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { HabitsService } from "./habits.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateHabitDto } from "./dto/create-habit.dto";
import { UpdateHabitDto } from "./dto/update-habit.dto";
import { CheckInDto } from "./dto/check-in.dto";

@ApiTags("Habits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("v1/habits")
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateHabitDto) {
    return this.habitsService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.habitsService.findAll(req.user.userId);
  }

  @Get(":id")
  findOne(@Req() req: any, @Param("id") id: string) {
    return this.habitsService.findOne(req.user.userId, id);
  }

  @Patch(":id")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateHabitDto,
  ) {
    return this.habitsService.update(req.user.userId, id, dto);
  }

  @Delete(":id")
  archive(@Req() req: any, @Param("id") id: string) {
    return this.habitsService.archive(req.user.userId, id);
  }

  @Post(":id/check-in")
  checkIn(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: CheckInDto,
  ) {
    return this.habitsService.checkIn(req.user.userId, id, dto);
  }

  @Get(":id/calendar")
  getCalendar(
    @Req() req: any,
    @Param("id") id: string,
    @Query("month") month: string,
  ) {
    return this.habitsService.getCalendar(req.user.userId, id, month);
  }
}