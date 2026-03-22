import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import AppleMobileLoginDto, GoogleMobileLoginDto } from "./dto/social-login.dto";

@ApiTags("Auth")
@Controller("v1/auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.name, dto.email, dto.password);
  }
   @Post("google/mobile")
   googleMobileLogin(@Body() dto: GoogleMobileLoginDto) {
     return this.authService.googleMobileLogin(dto.idToken);
   }

   @Post("apple/mobile")
   appleMobileLogin(@Body() dto: AppleMobileLoginDto) {
     return this.authService.appleMobileLogin(dto);
   }

  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: any) {
    return { userId: req.user.userId, email: req.user.email };
  }
}