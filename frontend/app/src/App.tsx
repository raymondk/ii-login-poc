import { useState, useEffect } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent } from "@icp-sdk/core/agent";
import { DelegationChain, DelegationIdentity } from "@icp-sdk/core/identity";
import type { PublicKey, DerEncodedPublicKey } from "@icp-sdk/core/agent";
import { createActor } from "./backend/api/backend";
import { getCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import "./App.css";

interface CanisterEnv {
  readonly "PUBLIC_CANISTER_ID:backend": string;
}

const canisterEnv = getCanisterEnv<CanisterEnv>();
const canisterId = canisterEnv["PUBLIC_CANISTER_ID:backend"];

// Read the target public key from the `k` query parameter (base64-encoded DER).
const targetPublicKeyParam = new URLSearchParams(window.location.search).get(
  "k"
);

function getIdentityProviderUrl() {
  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost");
  if (isLocal) {
    return "http://id.ai.localhost:8000";
  }
  return "https://id.ai";
}

/**
 * Decode a base64 string to a Uint8Array.
 */
function base64ToBytes(base64: string): Uint8Array {
  const std = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std.padEnd(std.length + ((4 - (std.length % 4)) % 4), "=");
  return Uint8Array.from(globalThis.atob(padded), (c) => c.charCodeAt(0));
}

/**
 * After II login, create a delegation from the authenticated identity to the
 * target public key and log it to the console.
 */
async function createDelegationForKey(
  authClient: AuthClient
): Promise<void> {
  if (!targetPublicKeyParam) return;

  const identity = authClient.getIdentity();
  if (!(identity instanceof DelegationIdentity)) {
    console.error("Expected a DelegationIdentity after login");
    return;
  }

  const targetDerBytes = base64ToBytes(targetPublicKeyParam);
  const derKey = Object.assign(targetDerBytes, {
    toDer() { return derKey; },
  }) as DerEncodedPublicKey;
  const targetPublicKey: PublicKey = { toDer: () => derKey };

  const existingChain = identity.getDelegation();
  const delegationChain = await DelegationChain.create(
    identity,
    targetPublicKey,
    new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
    { previous: existingChain }
  );

  console.log("Delegation chain for key:", delegationChain.toJSON());
}

function App() {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    AuthClient.create({ keyType: "Ed25519" }).then(async (client) => {
      setAuthClient(client);
      if (await client.isAuthenticated()) {
        const identity = client.getIdentity();
        setPrincipal(identity.getPrincipal().toText());
      }
    });
  }, []);

  function handleLogin() {
    if (!authClient) return;
    authClient.login({
      identityProvider: getIdentityProviderUrl(),
      maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000), // 8 hours
      onSuccess: async () => {
        const identity = authClient.getIdentity();
        setPrincipal(identity.getPrincipal().toText());
        await createDelegationForKey(authClient);
      },
      onError: (error) => {
        console.error("Login failed:", error);
      },
    });
  }

  async function handleLogout() {
    if (!authClient) return;
    await authClient.logout();
    setPrincipal(null);
    setGreeting("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authClient) return;

    const identity = authClient.getIdentity();
    const agent = HttpAgent.createSync({
      identity,
      host: window.location.origin,
      rootKey: canisterEnv?.IC_ROOT_KEY,
    });

    const actor = createActor(canisterId, { agent });
    const nameInput = (event.target as HTMLFormElement).elements.namedItem(
      "name"
    ) as HTMLInputElement;

    actor.greet(nameInput.value).then((result) => setGreeting(result));
  }

  const isAuthenticated = principal !== null;

  if (!targetPublicKeyParam) {
    return (
      <main className="page">
        <section className="panel">
          <h1 className="title">Missing public key</h1>
          <p className="subtitle">
            Provide a base64-encoded DER public key via the <code>k</code> query
            parameter.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="brand" aria-label="ICP plus Vite">
          <img src="/icp.svg" alt="ICP logo" className="brand-icp" />
          <span className="plus">+</span>
          <img src="/vite.svg" alt="Vite logo" className="brand-vite" />
        </div>
        <h1 className="title">Internet Identity Login</h1>

        {!isAuthenticated ? (
          <>
            <p className="subtitle">
              Sign in with Internet Identity to create a delegation.
            </p>
            <button
              className="button"
              onClick={handleLogin}
              disabled={!authClient}
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            <p className="subtitle">
              Signed in as: <code>{principal}</code>
            </p>
            <form className="form" action="#" onSubmit={handleSubmit}>
              <label htmlFor="name">Enter your name</label>
              <div className="controls">
                <input
                  id="name"
                  alt="Name"
                  type="text"
                  className="input"
                  placeholder="Ada Lovelace"
                />
                <button type="submit" className="button">
                  Greet me
                </button>
              </div>
            </form>
            <section id="greeting" className="greeting" aria-live="polite">
              {greeting}
            </section>
            <button className="button logout-button" onClick={handleLogout}>
              Sign out
            </button>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
