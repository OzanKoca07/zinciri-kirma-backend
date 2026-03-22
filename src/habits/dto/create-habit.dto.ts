import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateHabitDto {
  @ApiProperty({ example: "Kodlama calis 20 dk" })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: "🎯" })
  @IsString()
  @MaxLength(10)
  emoji: string;

  @ApiProperty({ example: "#22C55E" })
  @IsString()
  @MaxLength(20)
  color: string;

  @ApiProperty({
    example: "daily",
    enum: ["daily", "weekly", "custom"],
  })
  @IsIn(["daily", "weekly", "custom"])
  frequency: "daily" | "weekly" | "custom";

  @ApiProperty({ example: true, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  goal?: number;
}