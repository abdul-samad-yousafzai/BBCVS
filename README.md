# Blockchain-Based Certificate Verification

A Final Year Project that issues and verifies academic certificates using Ethereum.
A university issues a certificate whose SHA-256 fingerprint is stored in a smart
contract. Anyone can later upload the PDF, or enter its hash, and check whether the
certificate was issued and whether it has been revoked. Personal data is stored
off-chain; only the hash is written to the blockchain.

Possible results:

- **VALID**: the hash was issued and is not revoked.
- **REVOKED**: the hash was issued, then revoked by the issuer.
- **NOT FOUND**: the hash is not on the contract. The file was changed, or it was never issued.

## Architecture

| Component | Location | Role |
|---|---|---|
| Smart contract | `contracts/Certificate.sol` | Stores hashes, issuer, issue time, and revocation status |
| Express API | `src/server.js` | Verification, issuing, revocation, and roll-number lookup |
| PDF and hashing | `src/certificate-pdf.js`, `src/hash.js` | Sample certificate PDF and SHA-256 hash |
| Issuer logic | `src/issuer.js` | Issue and revoke workflow |
| Records database | `src/supabase.js`, `src/certificate-repository.js` | Supabase (PostgreSQL) student records |
| Web pages | `public/` | Built-in verification and issuer pages |
| React client | `client/` | Full frontend (Vite, React Router), deployable to Vercel |

## Requirements

- Node.js 22 or newer
- Git
- MetaMask (only for Sepolia testnet)

## Setup

```powershell
npm install
```

Create a `.env` file in the project root for Supabase (never commit it):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=your-anthropic-model-name
```

The Supabase `certificates` table needs the columns `roll_number` (unique), `student_name`,
`program`, `issue_date`, `hash` (unique), `transaction_hash`, `pdf_path`, `revoked`, and `created_at`.

## Running the tests

```powershell
npm test
```

All 33 tests should pass. The Supabase integration test runs only when both Supabase
variables are set, and is skipped otherwise.

## Local run

Use three PowerShell windows.

**Window 1: local blockchain (keep it running)**

```powershell
npx hardhat node
```

**Window 2: deploy the contract**

```powershell
node scripts/deploy.js
```

Copy the printed address.

**Window 3: API server**

```powershell
$env:CONTRACT_ADDRESS = "0x..."
node src/server.js
```

Open `http://localhost:3000/`. The local chain resets when `npx hardhat node` restarts,
so deploy again and re-issue certificates after a restart.

## Sepolia run

Secrets are entered at run time in PowerShell and are never saved in a file:

```powershell
$env:HARDHAT_NETWORK = "sepolia"
$env:SEPOLIA_RPC_URL = Read-Host -Prompt "Paste RPC URL"
$env:SEPOLIA_PRIVATE_KEY = "0x" + (Read-Host -Prompt "Paste test account private key without 0x")
node scripts/deploy.js
$env:CONTRACT_ADDRESS = "0x..."
node src/server.js
```

Use a test account with test ETH only. Never use a wallet that holds real funds.

## Frontend (React client)

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. In development, Vite proxies API calls to `http://localhost:3000`.
The client has pages for Home, Verify, Issuer (issue and revoke), Lookup, and a 404 page.

## API routes

| Method and route | Purpose |
|---|---|
| `GET /health` | Health check, returns `{ ok: true }` |
| `GET /verify/:hash` | Verify by hash, returns `{ status, issuer, issuedAt }` |
| `POST /verify-file` | Verify by PDF upload (multipart field `file`, max 10 MB) |
| `POST /assistant` | Ask an AI assistant to explain a blockchain result or answer system FAQs |
| `POST /extract-details` | Suggest certificate details from an uploaded PDF |
| `POST /check-design` | Get a visual opinion about the first page of an uploaded PDF |
| `POST /issue` | Issue a certificate (JSON: studentName, rollNumber, program, issueDate, verificationUrl) |
| `POST /revoke` | Revoke a certificate (JSON: hash) |
| `GET /certificates/roll/:rollNumber` | Look up a stored record, without the local PDF path |
| `GET /issuer` | Issuer portal page |
| `GET /` | Verification page |

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `CONTRACT_ADDRESS` | Server, scripts | Deployed `Certificate` address |
| `HARDHAT_NETWORK` | Server, scripts | Network name (`localhost` by default, or `sepolia`) |
| `PORT` | Server | HTTP port (default 3000) |
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key (server only) |
| `SEPOLIA_RPC_URL` | Hardhat (Sepolia) | RPC endpoint for Sepolia |
| `SEPOLIA_PRIVATE_KEY` | Hardhat (Sepolia) | Test account private key |
| `CORS_ORIGIN` | Server | Allowed frontend origin(s), comma-separated (default `http://localhost:5173`) |
| `VITE_API_BASE_URL` | Client | Backend URL for the deployed frontend (empty in local development) |
| `ANTHROPIC_API_KEY` | Server | Anthropic API key used by the assistant (server only) |
| `ANTHROPIC_MODEL` | Server | Anthropic model name used by the assistant |

The AI assistant explains blockchain verification results and answers questions about
the system. It never decides whether a certificate is valid; validity always comes
from the blockchain result.

## Privacy and AI

The PDF text extraction and design check features send extracted PDF text and a
rendered image of page 1 to the configured AI provider. Use only sample certificates
when trying these features. If real student data is ever sent to an AI provider,
students must be told before the data is sent. Extracted details and visual advice
are suggestions only; review every field before issuing. These features do not save
or issue anything by themselves.

## Demo certificates

Generated PDFs are clearly marked as sample certificates with a watermark and are not
real degrees. The university name is a placeholder. To change the design, edit the
constants at the top of `src/certificate-pdf.js`.

Generate a sample certificate:

```powershell
node scripts/generate-certificate.js "Alex Student" "CS-2026-001" "Computer Science" "2026-10-31" "http://localhost:3000/"
```

The PDF is saved under `certificates/`, and the command prints its path and SHA-256 hash.

## Issuing from the command line

```powershell
$env:CONTRACT_ADDRESS = "0x..."
node scripts/issue.js .\certificates\<file>.pdf
node scripts/verify.js .\certificates\<file>.pdf
```

## Deployment

- **Smart contract:** deployed to the Ethereum Sepolia testnet.
- **API:** Render, with the environment variables set in the Render dashboard and `CORS_ORIGIN` set to the frontend URL.
- **Frontend:** Vercel, with the root directory set to `client`, the build command `npm run build`, the output directory `dist`, and `VITE_API_BASE_URL` set to the API URL.

## Security notes

- Never commit `.env`, private keys, RPC keys, or service role keys. `.gitignore` excludes `.env`.
- Keys are supplied only as environment variables at run time, never written in code.
- Use test accounts only on Sepolia. Never use a wallet that holds real funds.
- The Supabase service role key is used on the server only. Browser code contains no secrets.
- Only the owner account of the contract can issue or revoke certificates.
- The issuer portal has no login yet. A production version needs authentication.

## Limitations

- Hashes depend on exact file bytes. Re-saving or re-exporting a PDF changes the hash.
- One owner key controls the contract, so multiple universities are not supported yet.
- The local Hardhat chain resets when it restarts.
- A valid result proves a certificate was issued. It does not prove the holder is the named student.