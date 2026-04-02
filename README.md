# II Login PoC

A proof-of-concept that lets a CLI tool obtain an Internet Identity delegation chain via a browser-based login flow.

## How It Works

A CLI tool needs to authenticate a user with Internet Identity but can't do so directly. Instead, it opens a browser window that handles the II login and stores the resulting delegation chain in a backend canister for the CLI to retrieve.

### Flow

1. The CLI generates a key pair and a UUID
2. The CLI calls `register(uuid, publicKey)` on the backend canister and receives a 6-character code
3. The CLI displays the code to the user and opens the frontend at `/cli-login`
4. The user enters the code in the browser
5. The frontend calls `lookup_code(code)` to retrieve the CLI's public key
6. The user signs in with Internet Identity in the browser
7. The frontend creates a delegation chain from the II identity to the CLI's public key
8. The delegation chain is stored in the backend canister via `store_delegation(code, chain)`
9. The browser logs out and closes automatically
10. The CLI polls `get_delegation(uuid)` to retrieve the delegation chain

### Frontend

A React app (Vite + React Router) with two routes:

- `/` — basic II login demo
- `/cli-login` — the code-based CLI login flow

The `/cli-login` route presents an OTP-style input where the user enters the 6-character code displayed by the CLI. Query parameters:

- `debug` (optional) — when present, shows a manual sign-out button instead of auto-closing

### Backend

A Motoko canister that manages registrations and stores delegation chains temporarily:

- `register(uuid, publicKey)` — registers a CLI session and returns a 6-character code (requires authenticated caller)
- `lookup_code(code)` — returns the public key for a registration code (query, unauthenticated)
- `store_delegation(code, chain)` — stores a delegation chain against a registration code (requires authenticated caller)
- `get_delegation(uuid)` — retrieves a delegation chain (query, unauthenticated, returns null if expired)

Registrations and delegations expire after 5 minutes and are cleaned up on each new store. Codes are generated from a 32-character alphabet (A–Z excluding I and O, plus 2–9) to avoid ambiguous characters.

## Known Vulnerabilities

This is a proof-of-concept and has several security issues that must be addressed before production use.

### Delegation Overwrite (High)

Any authenticated caller can overwrite a delegation for a valid registration code. An attacker who knows the code could replace a legitimate delegation with garbage (DoS) or with their own.

**Mitigation:** Only allow one write per code, or bind the code to the caller's principal.

### UUID Predictability (Medium)

`get_delegation` is unauthenticated. Guessing a UUID exposes the delegation chain. While this alone doesn't enable impersonation (the attacker lacks the private key), it leaks the user's II public key and delegation structure.

**Mitigation:** Enforce cryptographically random UUIDs with sufficient entropy. Consider delete-on-read semantics.

### Code Brute-Force (Medium)

The 6-character code has ~30 bits of entropy (32^6 ≈ 1 billion combinations). With a 5-minute expiry window this is likely sufficient, but there is no rate limiting on `lookup_code`.

**Mitigation:** Add rate limiting or lockout after failed lookup attempts.

### Other Issues

- Delegation chain is logged to the browser console (`console.log`) — capturable by extensions
- 8-hour delegation lifetime with no revocation mechanism
- Draining cycles by performing many registrations

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

Open the frontend at `http://<frontend_canister_id>.localhost:8000/cli-login`. Add `?debug` to keep the sign-out button and console logs visible.

Run the `./test-flow.sh` to test out the flow.

Stop the local network:

```bash
icp network stop
```
