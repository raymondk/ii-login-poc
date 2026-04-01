# II Login PoC

A proof-of-concept that lets a CLI tool obtain an Internet Identity delegation chain via a browser-based login flow.

## How It Works

A CLI tool needs to authenticate a user with Internet Identity but can't do so directly. Instead, it opens a browser window that handles the II login and stores the resulting delegation chain in a backend canister for the CLI to retrieve.

### Flow

1. The CLI generates a key pair and a UUID, then opens the frontend with query parameters `k` (base64-encoded DER public key) and `uuid`
2. The user signs in with Internet Identity in the browser
3. The frontend creates a delegation chain from the II identity to the CLI's public key
4. The delegation chain is stored in the backend canister under the UUID
5. The browser logs out and closes automatically
6. The CLI calls `get_delegation` with the UUID to retrieve the delegation chain

### Frontend

A React app that orchestrates the login flow. Query parameters:

- `k` (required) — base64-encoded DER public key to delegate to
- `uuid` (required) — identifier for storing/retrieving the delegation (max 36 chars)
- `debug` (optional) — when present, shows a manual sign-out button instead of auto-closing

### Backend

A Motoko canister that stores delegation chains temporarily:

- `store_delegation(uuid, chain)` — stores a delegation chain (requires authenticated caller)
- `get_delegation(uuid)` — retrieves a delegation chain (returns null if expired)

Delegations expire after 5 minutes and are cleaned up on each new store.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://docs.npmjs.com/)

## Run It

Start a local network:

```bash
icp network start -d
```

Deploy both canisters:

```bash
icp deploy
```

Open the frontend at `http://<frontend_canister_id>.localhost:8000/?k=<base64-key>&uuid=<uuid>`. Add `&debug` to keep the sign-out button and console logs visible.

Stop the local network:

```bash
icp network stop
```
