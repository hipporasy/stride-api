import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getValidToken, fetchActivity } from '../services/strava';
import { isMinted, mintBadge } from '../services/contract';
import { SessionUser } from '../types';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { activityId, walletAddress } = req.body as {
    activityId: number;
    walletAddress: string;
  };

  if (!activityId || !walletAddress) {
    res.status(400).json({ error: 'activityId and walletAddress are required' });
    return;
  }

  const user = req.user as SessionUser;

  try {
    const { accessToken, updated } = await getValidToken(user);
    if (updated) {
      await new Promise<void>((resolve, reject) => {
        req.logIn(updated, err => (err ? reject(err) : resolve()));
      });
    }

    const activity = await fetchActivity(accessToken, activityId);

    if (String(activity.athlete.id) !== user.stravaId) {
      res.status(400).json({ error: 'Activity does not belong to authenticated user' });
      return;
    }

    if (activity.type !== 'Run' && activity.sport_type !== 'Run') {
      res.status(422).json({ error: 'Activity is not a run' });
      return;
    }

    const alreadyMinted = await isMinted(activityId);
    if (alreadyMinted) {
      res.status(409).json({ error: 'Activity already minted' });
      return;
    }

    const runAt = Math.floor(new Date(activity.start_date).getTime() / 1000);
    const { txHash, tokenId } = await mintBadge(
      walletAddress as `0x${string}`,
      activityId,
      activity.distance,
      runAt,
    );

    res.json({ txHash, tokenId });
  } catch (err) {
    console.error('POST /mint error:', err);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

export default router;
