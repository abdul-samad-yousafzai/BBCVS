Project ka maqsad (blockchain-based certificate verification, fake degree detection)
Requirements (Node.js, Git)
Setup: npm install
Commands: npm test, npx hardhat node, node scripts/deploy.js, node src/server.js
API routes: GET /health, GET /verify/:hash, POST /verify-file
Limitations: local Hardhat chain reset hoti hai, private keys sirf local testing ke liye
# Certificate Verification

This project uses Hardhat 3 with Ethers and the native Node.js test runner.

## What's included?

The project includes contract compilation and tests, plus scripts for issuing and verifying certificate PDF hashes.

## Certificate PDF scripts

Start a local Hardhat node in one PowerShell window:

```powershell
npx hardhat node
```

In another window, set `CONTRACT_ADDRESS` to the deployed `Certificate` address and run:

```powershell
$env:CONTRACT_ADDRESS = "0x..."
node scripts/issue.js .\certificate.pdf
node scripts/verify.js .\certificate.pdf
```

The scripts use the `localhost` Hardhat network by default. To use another network,
configure it in `hardhat.config.ts` and set `$env:HARDHAT_NETWORK` to its name.
Configure network signers securely; no private keys are stored in these scripts.

Generate a certificate PDF with student name, roll number, program, issue date, and
verification URL:

```powershell
node scripts/generate-certificate.js "Alex Student" "CS-2026-001" "Computer Science" "2026-10-31" "https://example.com/verify/CS-2026-001"
```

The PDF is saved under `certificates/`; the command prints its path and SHA-256 hash.

## Verification HTTP API

Start the local Hardhat node and deploy `Certificate`, then run the server with the
deployed address:

```powershell
$env:CONTRACT_ADDRESS = "0x..."
$env:PORT = "3000"
node src/server.js
```

The server connects to the `localhost` Hardhat network by default; set
`$env:HARDHAT_NETWORK` to use another configured network. It provides
`GET /health`, `GET /verify/:hash`, and `POST /verify-file` (multipart field name
`file`, PDF uploads up to 10 MB).

## Issuer portal

Open `http://localhost:3000/issuer` to create and issue a certificate or revoke one
by its 32-byte hash. Issued PDF files are written to `certificates/`. Issuing and
revoking requires the configured network signer to be authorized as the contract
owner.

Certificate records are stored in the Supabase `certificates` table. Set
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the root `.env` file before
starting the server. Keep that file private and never expose the service role key
to browser code. The optional repository integration test is skipped unless both
variables are set.

The API also provides `GET /certificates/roll/:rollNumber` to retrieve a stored
certificate record without its local PDF path.
