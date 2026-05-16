import { Router } from 'express';
import { route } from '@/middleware/route';
import { getValidToken, fetchRecentRuns } from '@/services/strava';

const router = Router();

router.get('/', route().auth().handle(async ({ user }) => {
  return fetchRecentRuns(await getValidToken(user));
}));

export default router;
