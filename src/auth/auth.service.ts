// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (user && user.hashedPassword) {
      const isPasswordValid = await bcrypt.compare(
        password,
        user.hashedPassword,
      );
      if (isPasswordValid) {
        const { hashedPassword, ...result } = user;
        console.log('User validated:', hashedPassword);
        return result;
      }
    }
    return null;
  }

  async register(createUserDto: CreateUserDto): Promise<TokenPair> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.usersService.create({
      ...createUserDto,
      hashedPassword,
    });

    this.logger.log(`New user registered: ${user.email}`);

    return this.generateTokenPair(user);
  }

  async login(loginDto: LoginDto): Promise<TokenPair> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${user.email}`);

    return this.generateTokenPair(user);
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<TokenPair> {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });
      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      // Check if refresh token exists in database
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Generate new token pair
      const tokenPair = await this.generateTokenPair(storedToken.user);

      // Remove old refresh token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      return tokenPair;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Remove specific refresh token
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      });
    } else {
      // Remove all refresh tokens for user
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  async logoutFromAllDevices(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`User logged out from all devices: ${userId}`);
  }

  private async generateTokenPair(user: any): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshTokenPayload = { sub: user.id };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async validateJwtPayload(payload: JwtPayload): Promise<any> {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);

    if (!user || !user.hashedPassword) {
      throw new UnauthorizedException('User not found');
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.hashedPassword,
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedPassword: hashedNewPassword },
    });

    // Logout from all devices for security
    await this.logoutFromAllDevices(userId);

    this.logger.log(`Password changed for user: ${userId}`);
  }

  async resetPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists or not for security
      return;
    }

    // Generate reset token (in production, send via email)
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry
    console.log('Password reset token:', resetToken);
    // In a real application, you would:
    // 1. Store the reset token in database
    // 2. Send email with reset link
    // 3. Implement reset endpoint that validates token

    this.logger.log(`Password reset requested for: ${email}`);
  }
}
