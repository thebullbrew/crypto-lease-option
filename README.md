# LeaseOption

![banner](assets/banner.jpg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-627EEA.svg)](https://etherscan.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

A **rent-to-own / lease-option agreement as a smart contract**. The tenant pays
monthly rent on-chain; a fixed percentage of every payment accrues as purchase
credits. Finish the full lease term, pay the remaining balance, and the option
is exercised — the entire contract balance flows to the landlord. Built on
[Hardhat](https://hardhat.org), [OpenZeppelin Contracts](https://openzeppelin.com/contracts),
and [viem](https://viem.sh).

> **Note:** this contract governs the *payment mechanics* of a lease-option
> deal. It does not transfer legal title by itself. Pair it with a DeedNFT
> transfer (see
> [crypto-deed-nft-template](https://github.com/thebullbrew/crypto-deed-nft-template))
> and a properly drafted lease-option agreement for the full close.

## How the credits math works

- Deploy with an **option fee** (`msg.value`, held in the contract).
- Each `payRent()` credits `monthlyRent × rentCreditBps / 10000` toward the purchase.
- To exercise: `amountDue = strikePrice − rentCredits − optionFee` (floored at 0).
- `exerciseOption()` requires the full term paid and the exact `amountDue`,
  then pays the **whole contract balance** (rents + fee + exercise payment) to
  the landlord and locks the deal permanently.

### Worked example

| Term | Value |
|---|---|
| Monthly rent | 1.5 ETH |
| Term | 24 months |
| Strike price | 120 ETH |
| Rent credit | 2500 bps (25%) |
| Option fee | 5 ETH |

- Rent credits after 24 months: 24 × 1.5 × 25% = **9 ETH**
- Amount due at exercise: 120 − 9 − 5 = **106 ETH**
- Landlord receives on exercise: 36 (rents) + 5 (fee) + 106 = **147 ETH**

## Quickstart

```bash
npm install
npx hardhat compile
npm run build

cp .env.example .env   # fill in RPC_URL, PRIVATE_KEY

# 1. Deploy the agreement (payable — OPTION_FEE_ETH is msg.value)
TENANT=0xTenantAddress \
LANDLORD=0xLandlordAddress \
MONTHLY_RENT_ETH=1.5 \
TERM_MONTHS=24 \
STRIKE_PRICE_ETH=120 \
RENT_CREDIT_BPS=2500 \
OPTION_FEE_ETH=5 \
npm run deploy
# → set CONTRACT_ADDRESS in .env

# 2. Tenant pays rent each month (exact amount only)
CONTRACT_ADDRESS=0x... AMOUNT_ETH=1.5 npm run pay-rent

# 3. Check progress any time
CONTRACT_ADDRESS=0x... npm run status

# 4. After month 24, exercise the option
CONTRACT_ADDRESS=0x... AMOUNT_ETH=106 npm run exercise
```

## Contract API

| Function | Who | What |
|---|---|---|
| `constructor(...)` payable | Deployer | Sets terms; `msg.value` = option fee (must be > 0) |
| `payRent()` payable | Tenant only | Exact `monthlyRent`; accrues credits; one month at a time |
| `exerciseOption()` payable | Tenant only | After full term; exact `amountDue`; pays out landlord |
| `status()` view | Anyone | `(paidMonths, rentCredits, amountDue, exercised)` |

Events: `RentPaid(month, credits)`, `OptionExercised(amountDue)`.

## Security notes

- All economic terms (`tenant`, `landlord`, `monthlyRent`, `termMonths`,
  `strikePrice`, `rentCreditBps`, `optionFee`) are **immutable** — set them
  carefully at deploy; there is no admin key and no upgrade path.
- `payRent` enforces the exact monthly amount and sequential months — no
  partial, skipped, or double payments.
- There is no early-exercise and no refund path: if the tenant never finishes
  the term, funds stay locked. Structure the off-chain agreement accordingly.
- This template has not been audited. Do not use with real funds until it —
  and your legal structure — has been reviewed by qualified professionals.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
