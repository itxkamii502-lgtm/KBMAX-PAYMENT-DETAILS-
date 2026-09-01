import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { queryOne, hashPassword, verifyPassword, run } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET !== '<SET_IN_SECURE_CONFIG>'
  ? process.env.JWT_SECRET
  : 'kbmax_super_secret_jwt_key_2026';

// In-memory rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; lockUntil?: number }>();

export interface AuthTokenPayload {
  adminId: number;
  username: string;
  role: string;
  exp: number;
}

export function createToken(payload: { adminId: number; username: string; role: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: AuthTokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
    return;
  }

  // Attach admin payload
  (req as any).admin = payload;
  next();
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (record.lockUntil && record.lockUntil > now) {
    return { allowed: false, waitSeconds: Math.ceil((record.lockUntil - now) / 1000) };
  }

  return { allowed: true };
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockUntil = now + 15 * 60 * 1000; // 15 minutes lockout after 5 failed attempts
  }
  loginAttempts.set(ip, record);
}

export function recordSuccessfulLogin(ip: string) {
  loginAttempts.delete(ip);
}
