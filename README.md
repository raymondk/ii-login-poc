# II Login PoC

A proof-of-concept that lets a CLI tool obtain an Internet Identity delegation chain via a browser-based login flow.

## How It Works

A CLI tool needs to authenticate a user with Internet Identity but can't do so directly. Instead, it opens a browser window that handles the II login, creates a delegation chain, and POSTs it to a callback URL provided by the CLI.

### Flow

1. The CLI generates a key pair and starts a local HTTP server on a free port
2. The CLI opens the browser at the frontend's `/cli-login` route with query parameters:
   - `public_key` — the CLI's public key (base64-encoded DER)
   - `callback` — the URL to POST the delegation chain to (e.g. `http://localhost:PORT/callback`)
3. The user clicks "Sign in with Internet Identity"
4. The frontend creates a delegation chain from the II identity to the CLI's public key
5. The frontend POSTs the delegation chain (JSON) to the callback URL
6. The CLI receives the delegation chain and shuts down the HTTP server
7. The browser shows a success message and can be closed

### Frontend

A React app (Vite + React Router) with two routes:

- `/` — basic II login demo
- `/cli-login` — the CLI login flow

The `/cli-login` route reads the CLI's public key and callback URL from query parameters, handles II authentication, creates a delegation chain, and POSTs it back. Query parameters:

- `public_key` (required) — base64-encoded DER public key to delegate to
- `callback` (required) — URL to POST the delegation chain JSON to
- `debug` (optional) — when present, shows a manual sign-out button instead of auto-closing

### Backend

A Motoko canister with a utility endpoint:

- `whoami()` — returns the caller's principal (useful for verifying the delegation works)

## Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://docs.npmjs.com/)

## Run It

Start a local network:

```bash
icp network start -d
```

Deploy canisters:

```bash
icp deploy
```

Open the frontend at:
```
http://<frontend_canister_id>.localhost:8000/cli-login?public_key=BASE64KEY&callback=http://localhost:PORT/callback
```

Add `?debug` to keep the sign-out button visible.

Stop the local network:

```bash
icp network stop
```
