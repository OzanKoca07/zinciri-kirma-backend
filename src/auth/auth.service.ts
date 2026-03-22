import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(name: string, email: string, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException("Email already used");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { name, email, passwordHash },
    });

    return this.issueToken(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    return this.issueToken(user.id, user.email);
  }

  async googleMobileLogin(idToken: string) {
    const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID;
    const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID;

    if (!googleWebClientId) {
      throw new BadRequestException("GOOGLE_WEB_CLIENT_ID is not configured");
    }

    const audience = [googleWebClientId];
    if (googleIosClientId) {
      audience.push(googleIosClientId);
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new UnauthorizedException("Google email bilgisi alinamadi");
    }

    let user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(
        `google-social-login-${payload.email}-${Date.now()}`,
        10,
      );

      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? payload.given_name ?? "Google User",
          passwordHash,
        },
      });
    }

    return this.issueToken(user.id, user.email);
  }

  async appleMobileLogin(dto: {
    idToken: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }) {
    const appleAudience = process.env.APPLE_BUNDLE_ID;

    if (!appleAudience) {
      throw new BadRequestException("APPLE_BUNDLE_ID is not configured");
    }

    const appleJWKS = createRemoteJWKSet(
      new URL("https://appleid.apple.com/auth/keys"),
    );

    const { payload } = await jwtVerify(dto.idToken, appleJWKS, {
      issuer: "https://appleid.apple.com",
      audience: appleAudience,
    });

    const appleEmail =
      typeof payload.email === "string" ? payload.email : dto.email;

    if (!appleEmail) {
      throw new BadRequestException(
        "Apple email bilgisi alinamadi. Ilk giriste email uygulama tarafindan gonderilmeli.",
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: appleEmail },
    });

    if (!user) {
      const fullName =
        [dto.firstName, dto.lastName].filter(Boolean).join(" ").trim() ||
        "Apple User";

      const passwordHash = await bcrypt.hash(
        `apple-social-login-${appleEmail}-${Date.now()}`,
        10,
      );

      user = await this.prisma.user.create({
        data: {
          email: appleEmail,
          name: fullName,
          passwordHash,
        },
      });
    }

    return this.issueToken(user.id, user.email);
  }

  issueToken(userId: string, email: string) {
    const payload = { sub: userId, email, createdAt: new Date() };

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.ACCESS_TOKEN_SECRET || "ACCESS_TOKEN_SECRET",
      expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m") as any,
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET || "REFRESH_TOKEN_SECRET",
      expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || "365d") as any,
    });

    return { accessToken, refreshToken };
  }
}