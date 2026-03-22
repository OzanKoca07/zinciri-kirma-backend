import { IsOptional, IsString } from "class-validator";

export class GoogleMobileLoginDto {
  @IsString()
  idToken: string;
}

export class AppleMobileLoginDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}