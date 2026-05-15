import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getValidToken, fetchRecentRuns } from '../services/strava';
import { SessionUser } from '../types';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const user = req.user as SessionUser;

  try {
    const { accessToken, updated } = await getValidToken(user);
    if (updated) {
      await new Promise<void>((resolve, reject) => {
        req.logIn(updated, err => (err ? reject(err) : resolve()));
      });
    }

    const runs = await fetchRecentRuns(accessToken);
    res.json(runs);
  } catch (err) {
    console.error('GET /runs error:', err);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

export default router;
