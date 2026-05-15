import { Router } from 'express';
import { isMinted, mintBadge } from '../services/contract';

const router = Router();

// Only mounted in non-production — calls the contract directly, no Strava auth
router.post('/mint', async (req, res) => {
  const {
    walletAddress = '0x97Bb53AF0Be378246DF72a3D058615799F8249BF',
    activityId = 9999999999,
    distance = 5000,
    runAt = Math.floor(Date.now() / 1000) - 3600,
  } = req.body as {
    walletAddress?: string;
    activityId?: number;
    distance?: number;
    runAt?: number;
  };

  try {
    const alreadyMinted = await isMinted(activityId);
    if (alreadyMinted) {
      res.status(409).json({ error: 'Activity already minted' });
      return;
    }

    const { txHash, tokenId } = await mintBadge(
      walletAddress as `0x${string}`,
      activityId,
      distance,
      runAt,
    );

    res.json({ txHash, tokenId });
  } catch (err) {
    console.error('DEV /mint error:', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
