import axios from 'axios';
import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { SessionUser } from '../types';

const TOKEN_REFRESH_BUFFER = 300; // seconds

interface StravaProfile {
  id: string;
}

type StravaVerify = (
  accessToken: string,
  refreshToken: string,
  profile: StravaProfile,
  done: (err: Error | null, user?: SessionUser) => void,
) => void;

class StravaStrategy extends OAuth2Strategy {
  override name = 'strava';

  constructor(
    options: { clientID: string; clientSecret: string; callbackURL: string },
    verify: StravaVerify,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super({ authorizationURL: 'https://www.strava.com/oauth/authorize', tokenURL: 'https://www.strava.com/oauth/token', ...options }, verify as any);
  }

  override userProfile(
    accessToken: string,
    done: (err: Error | null, profile?: StravaProfile) => void,
  ): void {
    axios
      .get<{ id: number }>('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(({ data }) => done(null, { id: String(data.id) }))
      .catch((err: unknown) =>
        done(err instanceof Error ? err : new Error(String(err))),
      );
  }
}

export function configurePassport(): void {
  passport.use(
    new StravaStrategy(
      {
        clientID: process.env.STRAVA_CLIENT_ID!,
        clientSecret: process.env.STRAVA_CLIENT_SECRET!,
        callbackURL: process.env.STRAVA_REDIRECT_URI!,
      },
      (accessToken, refreshToken, profile, done) => {
        done(null, {
          stravaId: profile.id,
          accessToken,
          refreshToken,
          tokenExpiresAt: Math.floor(Date.now() / 1000) + 21600,
        });
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as SessionUser));
}

export async function getValidToken(
  user: SessionUser,
): Promise<{ accessToken: string; updated: SessionUser | null }> {
  const now = Math.floor(Date.now() / 1000);
  if (user.tokenExpiresAt > now + TOKEN_REFRESH_BUFFER) {
    return { accessToken: user.accessToken, updated: null };
  }

  const { data } = await axios.post<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }>('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: user.refreshToken,
  });

  const updated: SessionUser = {
    ...user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: data.expires_at,
  };

  return { accessToken: data.access_token, updated };
}

export async function fetchActivity(accessToken: string, activityId: number) {
  const { data } = await axios.get(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return data;
}

export async function fetchRecentRuns(accessToken: string) {
  const { data } = await axios.get<{ type: string; sport_type: string }[]>(
    'https://www.strava.com/api/v3/athlete/activities',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 30, page: 1 },
    },
  );
  return data.filter(a => a.type === 'Run' || a.sport_type === 'Run');
}
