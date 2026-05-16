import { db } from '@/db/index';
import { mints } from '@/db/schema';

export interface MintPayload {
  userId: string;
  activityId: number;
  txHash: string;
  tokenId: number;
  distance: number;
  movingTime: number;
  elevationGain: number;
  runAt: Date;
  walletAddress: string;
  chainId: number;
  contractAddress: string;
}

export async function recordMint(payload: MintPayload): Promise<typeof mints.$inferSelect | null> {
  const [row] = await db.insert(mints)
    .values(payload)
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}
