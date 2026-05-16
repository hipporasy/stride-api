export interface SessionUser {
  userId: string;        // UUID — internal stable ID
  refType: string;       // e.g. 'strava'
  refId: string;         // provider-specific ID (e.g. Strava athlete ID)
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number; // unix seconds
}

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends SessionUser {}
  }
}
