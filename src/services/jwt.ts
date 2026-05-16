import jwt from 'jsonwebtoken';
import { SessionUser } from '../types';

const SECRET = process.env.SESSION_SECRET!;
const EXPIRES_IN = '30d';

export function issueToken(user: SessionUser): string {
  return jwt.sign(
    {
      stravaId: user.stravaId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiresAt: user.tokenExpiresAt,
    },
    SECRET,
    { expiresIn: EXPIRES_IN },
  );
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const p = jwt.verify(token, SECRET) as SessionUser;
    return {
      stravaId: p.stravaId,
      accessToken: p.accessToken,
      refreshToken: p.refreshToken,
      tokenExpiresAt: p.tokenExpiresAt,
    };
  } catch {
    return null;
  }
}
