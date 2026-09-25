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
 * Exercise the purchase option after the full term is paid.
 *
 * The signing key must be the tenant. AMOUNT_ETH must equal the contract's
 * computed amountDue exactly (strikePrice − rentCredits − optionFee, floored
 * at 0). Run `npm run status` first to see the exact figure.
 *
 * Env:
 *   CONTRACT_ADDRESS — deployed LeaseOption
 *   AMOUNT_ETH       — e.g. "92.5"
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
  if (!amountRaw) throw new Error("Set AMOUNT_ETH — run `npm run status` to see the exact amountDue.");
  const amount = parseEther(amountRaw);

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Tenant:   ${account.address}`);
  console.log(`Contract: ${config.contractAddress}`);
  console.log(`Paying:   ${amountRaw} ETH (amountDue)`);

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "exerciseOption",
    value: amount,
  });
  console.log(`Tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log("Option exercised — full contract balance paid out to the landlord.");
  console.log("Remember: pair this with the DeedNFT transfer to complete the close.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
