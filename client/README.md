# CertSure Frontend

This React frontend lets students verify certificate PDFs or hashes, look up
certificate records by roll number, and lets authorized issuers issue or revoke
certificates through the separate Express API.

## Local development

From the `client` directory:

```powershell
npm install
npm run dev
```

When `VITE_API_BASE_URL` is empty or unset, Vite proxies API requests to
`http://localhost:3000`. Start the backend separately before using API features.

## Production build

```powershell
npm run build
```

The static production output is written to `dist`.

## Deploying to Vercel

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `client`.
3. Select **Vite** as the Framework Preset.
4. Set the Build Command to `npm run build`.
5. Set the Output Directory to `dist`.
6. In **Project Settings > Environment Variables**, add
   `VITE_API_BASE_URL` with the deployed backend URL.
7. Redeploy the project.

The `VITE_API_BASE_URL` value is public frontend configuration, not a secret.
Never put private keys or service-role credentials in frontend environment
variables.

## QR scanner

The Verify page can scan a certificate QR code with a camera or from an image.
Camera access requires HTTPS in production; localhost is allowed during
development. QR content may be a plain `0x`-prefixed 64-character hexadecimal
hash, a URL containing `/verify/0x...`, or a URL containing `?hash=0x...`.
Scanned content is only used to populate the hash field and is verified through
the normal blockchain-backed verification flow.

## Backend configuration

Deploy the Express API separately and set `CORS_ORIGIN` to the deployed Vercel
origin. Configure backend-only environment variables on the backend host:
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CONTRACT_ADDRESS`,
`HARDHAT_NETWORK`, `SEPOLIA_RPC_URL`, and `SEPOLIA_PRIVATE_KEY`. Never add these
credentials to the frontend.
