import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

/**
 * Pay one month of rent into the LeaseOption contract.
 *
 * The signing key must be the tenant. AMOUNT_ETH must equal the contract's
 * monthlyRent exactly.
 *
 * Env:
 *   CONTRACT_ADDRESS — deployed LeaseOption
 *   AMOUNT_ETH       — e.g. "1.5"
 */

const ARTIFACT_PATH = join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "LeaseOption.sol",
  "LeaseOption.json"
);

interface ContractArtifact {
  abi: Abi;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not set — deploy first (`npm run deploy`).");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;

  const amountRaw = process.env.AMOUNT_ETH;
  if (!amountRaw) throw new Error("Set AMOUNT_ETH, e.g. AMOUNT_ETH=1.5.");
  const amount = parseEther(amountRaw);

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Tenant:   ${account.address}`);
  console.log(`Contract: ${config.contractAddress}`);
  console.log(`Paying:   ${amountRaw} ETH`);

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "payRent",
    value: amount,
  });
  console.log(`Tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log("Check progress with: npm run status");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
