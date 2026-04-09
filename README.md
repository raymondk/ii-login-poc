# @icp-sdk/cli-auth

A library for authenticating CLI tools with [Internet Identity](https://id.ai) via a browser-based delegation flow.

## Overview

CLI tools can't interact with Internet Identity directly. This library provides the browser-side logic to handle the login, create a delegation chain for the CLI's public key, and POST it back to the CLI via a callback URL.

### Flow

1. The CLI generates a key pair and starts a local HTTP server
2. The CLI opens a browser with the frontend's login page, passing `public_key` and `callback` as URL parameters
3. The user signs in with Internet Identity
4. The library creates a delegation chain from the II identity to the CLI's public key
5. The delegation chain is POSTed to the CLI's callback URL
6. The CLI receives the delegation and can make authenticated calls

## Install

```bash
npm install @icp-sdk/cli-auth
```

Peer dependencies: `@icp-sdk/auth` and `@icp-sdk/core`.

## Usage

```ts
import { parseCliLoginParams, performCliLogin } from "@icp-sdk/cli-auth";
import { AuthClient } from "@icp-sdk/auth/client";

// Parse public_key and callback from the URL hash
const params = parseCliLoginParams(window.location.hash);

const authClient = await AuthClient.create({ keyType: "Ed25519" });

performCliLogin(authClient, params, {
  onSigningIn: () => console.log("Waiting for Internet Identity..."),
  onSending: () => console.log("Sending delegation to CLI..."),
  onFinished: () => console.log("Done!"),
  onError: (message) => console.error(message),
}, {
  identityProvider: "https://id.ai",
});
```

## Callback Payload

The delegation chain is POSTed as JSON to the CLI's callback URL:

```json
{
  "publicKey": "302a300506032b6570032100...",
  "delegations": [
    {
      "delegation": {
        "pubkey": "302a300506032b6570032100...",
        "expiration": "1757389200000000000"
      },
      "signature": "aef..."
    }
  ]
}
```

All values are hex-encoded. The `expiration` is in nanoseconds since the Unix epoch. The `targets` field may optionally appear in a delegation to scope it to specific canister IDs.

## API

### `parseCliLoginParams(hash: string): CliLoginParams | null`

Parses `public_key` and `callback` from a URL hash string. Returns `null` if either parameter is missing.

### `createDelegationForKey(authClient, publicKeyBase64, expirationMs?): Promise<JsonnableDelegationChain | null>`

Creates a delegation chain from the authenticated identity to the given public key. Defaults to 8 hours expiration.

### `performCliLogin(authClient, params, callbacks, options): void`

Runs the full login flow: triggers II authentication, creates the delegation, and POSTs it to the callback URL.

**Options:**
- `identityProvider` — the Internet Identity URL
- `expirationMs` — optional delegation expiration in milliseconds (default: 8 hours)

## License

Apache-2.0
