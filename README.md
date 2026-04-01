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

## Known Vulnerabilities

This is a proof-of-concept and has several security issues that must be addressed before production use.

### Session Fixation (Critical)

The target public key (`k`) and session ID (`uuid`) are passed as URL query parameters with no server-side verification. An attacker can craft a link with their own public key and UUID, send it to a victim, and the victim's II login will delegate to the attacker's key. The attacker then retrieves the delegation and has both the chain and the matching private key — full impersonation for up to 8 hours.

**Mitigation:** Use an out-of-band confirmation code (similar to Bluetooth pairing). The CLI generates a short code and displays it in the terminal. The frontend displays the same code derived from the session, and the user confirms they match before authenticating. A phishing link would show a code the user can't verify against their own CLI, making the attack detectable. Simply moving the public key from the URL to a pre-registration step does not help — the attacker can register their own key and send a phishing link with their UUID.

### Delegation Overwrite (High)

Any authenticated caller can overwrite any UUID's stored delegation. An attacker could replace a legitimate delegation with garbage (DoS) or with their own delegation.

**Mitigation:** Only allow one write per UUID, or bind the UUID to the caller's principal.

### UUID Predictability (Medium)

`get_delegation` is unauthenticated. Guessing a UUID exposes the delegation chain. While this alone doesn't enable impersonation (the attacker lacks the private key), it leaks the user's II public key and delegation structure.

**Mitigation:** Enforce cryptographically random UUIDs with sufficient entropy. Consider delete-on-read semantics.

### Other Issues

- Delegation chain is logged to the browser console (`console.log`) — capturable by extensions
- 8-hour delegation lifetime with no revocation mechanism
- UUID in URL leaks via browser history, referer headers, and server logs
- No public key format validation on the `k` parameter

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
