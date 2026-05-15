export interface SessionUser {
  stravaId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number; // unix seconds
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends SessionUser {}
  }
}
