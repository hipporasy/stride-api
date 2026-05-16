import axios from 'axios';
import { randomUUID } from 'crypto';
import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { SessionUser } from '@/types';
import { StravaAthlete, StravaActivity, StravaTokenResponse } from '@/types/strava';
import { upsertIdentity, getUserByRef, getUserByIdAndRefType, updateTokens } from '@/db/users';

const TOKEN_REFRESH_BUFFER = 300; // seconds before expiry to refresh

interface StravaTokenParams {
  expires_at: number;
}

type StravaVerify = (
  accessToken: string,
  refreshToken: string,
  params: StravaTokenParams,
  profile: { id: string },
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
    done: (err: Error | null, profile?: { id: string }) => void,
  ): void {
    axios
      .get<StravaAthlete>('https://www.strava.com/api/v3/athlete', {
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
      async (accessToken, refreshToken, params, profile, done) => {
        try {
          const existing = await getUserByRef('strava', profile.id);
          const user: SessionUser = {
            userId: existing?.userId ?? randomUUID(),
            refType: 'strava',
            refId: profile.id,
            accessToken,
            refreshToken,
            tokenExpiresAt: params.expires_at,
          };
          await upsertIdentity(user);
          done(null, user);
        } catch (err) {
          done(err instanceof Error ? err : new Error(String(err)));
        }
      },
    ),
  );

  // Store only the stable session key — never put tokens in the session cookie
  passport.serializeUser((user, done) => {
    const { userId, refType } = user as SessionUser;
    done(null, { userId, refType });
  });

  passport.deserializeUser(async (payload: { userId: string; refType: string }, done) => {
    try {
      const user = await getUserByIdAndRefType(payload.userId, payload.refType);
      done(null, user ?? false);
    } catch (err) {
      done(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export async function getValidToken(user: SessionUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (user.tokenExpiresAt > now + TOKEN_REFRESH_BUFFER) {
    return user.accessToken;
  }

  const { data } = await axios.post<StravaTokenResponse>(
    'https://www.strava.com/oauth/token',
    {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
    },
  );

  await updateTokens(user.refType, user.refId, data.access_token, data.refresh_token, data.expires_at);

  return data.access_token;
}

export async function fetchActivity(accessToken: string, activityId: number): Promise<StravaActivity> {
  const { data } = await axios.get<StravaActivity>(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function fetchRecentRuns(accessToken: string): Promise<StravaActivity[]> {
  const { data } = await axios.get<StravaActivity[]>(
    'https://www.strava.com/api/v3/athlete/activities',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 30, page: 1 },
    },
  );
  return data.filter(a => a.type === 'Run' || a.sport_type === 'Run');
}
