import { Router } from 'express';
import { z } from 'zod';
import { route } from '@/middleware/route';
import { isMinted, mintBadge } from '@/services/contract';
import { recordMint } from '@/db/mints';
import { AppError } from '@/middleware/errors';

const router = Router();

const devMintSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default('0x97Bb53AF0Be378246DF72a3D058615799F8249BF'),
  activityId: z.number().int().positive().default(9999999999),
  distance: z.number().positive().default(5000),
  movingTime: z.number().int().positive().default(1500),
  elevationGain: z.number().nonnegative().default(0),
  runAt: z.number().int().default(() => Math.floor(Date.now() / 1000) - 3600),
});

router.post('/mint', route().body(devMintSchema).handle(async ({ body }) => {
  const { walletAddress, activityId, distance, movingTime, elevationGain, runAt } = body;

  const alreadyMinted = await isMinted(activityId);
  if (alreadyMinted) {
    throw new AppError(409, 'Activity already minted');
  }

  const { txHash, tokenId } = await mintBadge(
    walletAddress as `0x${string}`,
    activityId,
    distance,
    runAt,
  );

  await recordMint({
    userId: '00000000-0000-0000-0000-000000000000',
    activityId,
    txHash,
    tokenId,
    distance,
    movingTime,
    elevationGain,
    runAt: new Date(runAt * 1000),
    walletAddress,
    chainId: Number(process.env.CHAIN_ID),
    contractAddress: process.env.CONTRACT_ADDRESS!,
  });

  return { txHash, tokenId };
}));

export default router;
