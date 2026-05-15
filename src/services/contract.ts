import { createPublicClient, createWalletClient, http, parseAbi, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, sepolia } from 'viem/chains';

const ABI = parseAbi([
  'function mint(address to, uint256 activityId, uint256 distance, uint256 runAt) returns (uint256)',
  'function activityMinted(uint256 activityId) view returns (bool)',
]);

const CHAINS: Record<number, Chain> = { 8453: base, 84532: baseSepolia, 11155111: sepolia };
const chain: Chain = CHAINS[Number(process.env.CHAIN_ID)] ?? sepolia;
const account = privateKeyToAccount(process.env.MINTER_PRIVATE_KEY as `0x${string}`);
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(process.env.RPC_URL),
});

export async function isMinted(activityId: number): Promise<boolean> {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'activityMinted',
    args: [BigInt(activityId)],
  });
}

export async function mintBadge(
  to: `0x${string}`,
  activityId: number,
  distance: number,
  runAt: number,
): Promise<{ txHash: string; tokenId: number }> {
  const { request, result: tokenId } = await publicClient.simulateContract({
    account,
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'mint',
    args: [to, BigInt(activityId), BigInt(Math.round(distance)), BigInt(runAt)],
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash, tokenId: Number(tokenId) };
}
