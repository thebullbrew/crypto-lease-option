import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, http, formatEther, type Abi } from "viem";
import { chain, config } from "./config";

/**
 * Print the current status of a LeaseOption contract.
 *
 * Env:
 *   CONTRACT_ADDRESS — deployed LeaseOption
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

  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const address = config.contractAddress;

  const [tenant, landlord, monthlyRent, termMonths, strikePrice, rentCreditBps, optionFee] =
    (await Promise.all([
      publicClient.readContract({ address, abi: artifact.abi, functionName: "tenant" }),
      publicClient.readContract({ address, abi: artifact.abi, functionName: "landlord" }),
      publicClient.readContract({ address, abi: artifact.abi, functionName: "monthlyRent" }),
      publicClient.readContract({ address, abi: artifact.abi, functionName: "termMonths" }),
      publicClient.readContract({ address, abi: artifact.abi, functionName: "strikePrice" }),
      publicClient.readContract({ address, abi: artifact.abi, functionName: "rentCreditBps" }),
      publicClient.readContract({ address, abi: artifact.abi, functionName: "optionFee" }),
    ])) as [string, string, bigint, bigint, bigint, bigint, bigint];

  const [paidMonths, rentCredits, amountDue, exercised] = (await publicClient.readContract({
    address,
    abi: artifact.abi,
    functionName: "status",
  })) as [bigint, bigint, bigint, boolean];

  console.log("── LeaseOption status ──────────────────────────");
  console.log(`Contract:      ${address}`);
  console.log(`Tenant:        ${tenant}`);
  console.log(`Landlord:      ${landlord}`);
  console.log(`Monthly rent:  ${formatEther(monthlyRent)} ETH`);
  console.log(`Term:          ${termMonths} months`);
  console.log(`Strike price:  ${formatEther(strikePrice)} ETH`);
  console.log(`Rent credit:   ${rentCreditBps} bps (${Number(rentCreditBps) / 100}%)`);
  console.log(`Option fee:    ${formatEther(optionFee)} ETH`);
  console.log("───────────────────────────────────────────────");
  console.log(`Months paid:   ${paidMonths} / ${termMonths}`);
  console.log(`Rent credits:  ${formatEther(rentCredits)} ETH`);
  console.log(`Amount due:    ${formatEther(amountDue)} ETH`);
  console.log(`Exercised:     ${exercised}`);
  if (!exercised && paidMonths === termMonths) {
    console.log(`\nReady to exercise: AMOUNT_ETH=${formatEther(amountDue)} npm run exercise`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
