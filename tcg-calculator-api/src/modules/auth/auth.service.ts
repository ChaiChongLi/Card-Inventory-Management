import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { AuthPayload } from '../../middleware/auth.middleware';

const REFRESH_TOKEN_BYTES = 64;

// Parse duration strings like "7d", "15m" into milliseconds for DB expiry calculation
function parseDurationMs(duration: string): number {
  const unit = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1), 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const multiplier = multipliers[unit];
  if (!multiplier || isNaN(value)) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  return value * multiplier;
}

function generateAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

async function generateRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRY));

  await prisma.refreshToken.create({
    data: { token, userId, expiresAt, isRevoked: false },
  });

  return token;
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: { id: number; username: string; role: string } }> {
  const user = await prisma.user.findFirst({
    where: { username, isDeleted: false },
  });

  if (!user) {
    // Use constant-time comparison to avoid username enumeration
    await bcrypt.hash('dummy-prevent-timing-attack', 10);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Your account has been deactivated');
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  };
}

export async function refreshAccessToken(
  rawToken: string,
): Promise<{ accessToken: string; user: { id: number; username: string; role: string } }> {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: rawToken },
    include: { user: true },
  });

  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }

  if (storedToken.user.isDeleted || !storedToken.user.isActive) {
    // Revoke the token and reject
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is no longer active');
  }

  const payload: AuthPayload = {
    userId: storedToken.user.id,
    username: storedToken.user.username,
    role: storedToken.user.role,
  };

  const accessToken = generateAccessToken(payload);
  return {
    accessToken,
    user: { id: storedToken.user.id, username: storedToken.user.username, role: storedToken.user.role },
  };
}

export async function logoutUser(rawToken: string): Promise<void> {
  // Revoke the specific refresh token — ignore if it doesn't exist
  await prisma.refreshToken.updateMany({
    where: { token: rawToken, isRevoked: false },
    data: { isRevoked: true },
  });
}

export async function getCurrentUser(
  userId: number,
): Promise<{ id: number; username: string; role: string; isActive: boolean; createdAt: Date }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { id: true, username: true, role: true, isActive: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return user;
}
