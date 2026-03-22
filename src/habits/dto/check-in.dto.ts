import { ApiProperty } from "@nestjs/swagger";
import { HabitLogStatus } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Min } from "class-validator";

export class CheckInDto {
  @ApiProperty({ example: "2026-03-15" })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: HabitLogStatus, example: HabitLogStatus.DONE })
  @IsEnum(HabitLogStatus)
  status: HabitLogStatus;

  @ApiProperty({ example: 30, required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  progress?: number;

  @ApiProperty({ example: false, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  useRecovery?: boolean;
}