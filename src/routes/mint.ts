import { Router } from 'express';
import { z } from 'zod';
import { route } from '@/middleware/route';
import { AppError } from '@/middleware/errors';
import { getValidToken, fetchActivity } from '@/services/strava';
import { isMinted, mintBadge } from '@/services/contract';
import { recordMint } from '@/db/mints';

const router = Router();

const mintSchema = z.object({
  activityId: z.number().int().positive(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
});

router.post('/', route().auth().body(mintSchema).handle(async ({ body, user }) => {
  const { activityId, walletAddress } = body;

  const accessToken = await getValidToken(user);
  const activity = await fetchActivity(accessToken, activityId);

  if (String(activity.athlete.id) !== user.refId) {
    throw new AppError(400, 'Activity does not belong to authenticated user');
  }
  if (activity.type !== 'Run' && activity.sport_type !== 'Run') {
    throw new AppError(422, 'Activity is not a run');
  }

  const alreadyMinted = await isMinted(activityId);
  if (alreadyMinted) {
    throw new AppError(409, 'Activity already minted');
  }

  const runAt = Math.floor(new Date(activity.start_date).getTime() / 1000);
  const { txHash, tokenId } = await mintBadge(
    walletAddress as `0x${string}`,
    activityId,
    activity.distance,
    runAt,
  );

  await recordMint({
    userId: user.userId,
    activityId,
    txHash,
    tokenId,
    distance: activity.distance,
    movingTime: activity.moving_time,
    elevationGain: activity.total_elevation_gain,
    runAt: new Date(activity.start_date),
    walletAddress,
    chainId: Number(process.env.CHAIN_ID),
    contractAddress: process.env.CONTRACT_ADDRESS!,
  });

  return { txHash, tokenId };
}));

export default router;
