import { useState, useEffect } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent } from "@icp-sdk/core/agent";
import { createActor } from "./backend/api/backend";
import { getCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import "./App.css";

interface CanisterEnv {
  readonly "PUBLIC_CANISTER_ID:backend": string;
}

const canisterEnv = getCanisterEnv<CanisterEnv>();
const canisterId = canisterEnv["PUBLIC_CANISTER_ID:backend"];

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

function App() {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    AuthClient.create().then(async (client) => {
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
      onSuccess: () => {
        const identity = authClient.getIdentity();
        setPrincipal(identity.getPrincipal().toText());
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
            <p className="subtitle">Sign in with Internet Identity to get started.</p>
            <button className="button" onClick={handleLogin} disabled={!authClient}>
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
