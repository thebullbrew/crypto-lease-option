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
 * Deploy a LeaseOption contract (payable — the option fee is msg.value).
 *
 * Env:
 *   TENANT, LANDLORD            — 0x addresses
 *   MONTHLY_RENT_ETH            — e.g. "1.5"
 *   TERM_MONTHS                 — e.g. "24"
 *   STRIKE_PRICE_ETH            — e.g. "120"
 *   RENT_CREDIT_BPS             — e.g. "2500" (25% of each rent credited)
 *   OPTION_FEE_ETH              — e.g. "5" (sent as msg.value at deploy)
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
  bytecode: `0x${string}`;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function address(name: string): `0x${string}` {
  const raw = env(name);
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`${name} must be a 20-byte hex address, got "${raw}".`);
  }
  return normalized as `0x${string}`;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;

  const tenant = address("TENANT");
  const landlord = address("LANDLORD");
  const monthlyRent = parseEther(env("MONTHLY_RENT_ETH"));
  const termMonths = BigInt(env("TERM_MONTHS"));
  const strikePrice = parseEther(env("STRIKE_PRICE_ETH"));
  const rentCreditBps = BigInt(env("RENT_CREDIT_BPS"));
  const optionFee = parseEther(env("OPTION_FEE_ETH"));

  if (rentCreditBps > 10000n) throw new Error("RENT_CREDIT_BPS must be <= 10000.");

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Network:        ${chain.name} (chain id ${chain.id})`);
  console.log(`Deployer:       ${account.address}`);
  console.log(`Tenant:         ${tenant}`);
  console.log(`Landlord:       ${landlord}`);
  console.log(`Monthly rent:   ${env("MONTHLY_RENT_ETH")} ETH`);
  console.log(`Term:           ${env("TERM_MONTHS")} months`);
  console.log(`Strike price:   ${env("STRIKE_PRICE_ETH")} ETH`);
  console.log(`Rent credit:    ${env("RENT_CREDIT_BPS")} bps`);
  console.log(`Option fee:     ${env("OPTION_FEE_ETH")} ETH (msg.value)`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    value: optionFee,
    args: [tenant, landlord, monthlyRent, termMonths, strikePrice, rentCreditBps],
  });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`LeaseOption deployed at: ${receipt.contractAddress}`);
  console.log(`\nSet CONTRACT_ADDRESS=${receipt.contractAddress} in your .env`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
