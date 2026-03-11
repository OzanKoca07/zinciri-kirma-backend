import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) { }

  async register(name: string, email: string, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException("Email already used");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({ data: { name, email, passwordHash } });

    return this.issueToken(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return this.issueToken(user.id, user.email);
  }

  issueToken(userId: string, email: string) {
    // * Kullanılmayan refresh tokenlerin, veri tabanında saklanacağı süreyi tahmin edebilmek için "createdAt" eklendi.
    const payload = { sub: userId, email, createdAt: new Date() };

    // Access token (kısa ömürlü, örn: 15 dk)
    const accessToken = this.jwt.sign(payload, {
      secret: 'ACCESS_TOKEN_SECRET',
      expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') as any,
    });

    // Refresh token (uzun ömürlü, örn: 6 - 12 ay)
    const refreshToken = this.jwt.sign(payload, {
      secret: 'REFRESH_TOKEN_SECRET',
      expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '365d') as any,
    });

    return { accessToken, refreshToken };
  }
}