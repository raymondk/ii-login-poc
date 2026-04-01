import { useState, useEffect } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent } from "@icp-sdk/core/agent";
import {
  DelegationChain,
  DelegationIdentity,
  type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import type { PublicKey, DerEncodedPublicKey } from "@icp-sdk/core/agent";
import { createActor } from "./backend/api/backend";
import { getCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { getIdentityProviderUrl, base64ToBytes } from "./utils";
import "./App.css";

interface CanisterEnv {
  readonly "PUBLIC_CANISTER_ID:backend": string;
}

const canisterEnv = getCanisterEnv<CanisterEnv>();
const canisterId = canisterEnv["PUBLIC_CANISTER_ID:backend"];

const params = new URLSearchParams(window.location.search);
const debugParam = params.has("debug");

type Step = "enter-code" | "login" | "finished";

async function createDelegationForKey(
  authClient: AuthClient,
  targetPublicKeyBase64: string
): Promise<JsonnableDelegationChain | null> {
  const identity = authClient.getIdentity();
  if (!(identity instanceof DelegationIdentity)) {
    console.error("Expected a DelegationIdentity after login");
    return null;
  }

  const targetDerBytes = base64ToBytes(targetPublicKeyBase64);
  const derKey = Object.assign(targetDerBytes, {
    toDer() {
      return derKey;
    },
  }) as DerEncodedPublicKey;
  const targetPublicKey: PublicKey = { toDer: () => derKey };

  const existingChain = identity.getDelegation();
  const delegationChain = await DelegationChain.create(
    identity,
    targetPublicKey,
    new Date(Date.now() + 8 * 60 * 60 * 1000),
    { previous: existingChain }
  );

  const json = delegationChain.toJSON();
  console.log("Delegation chain for key: ", json);
  return json;
}

function CliLogin() {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [shortCode, setShortCode] = useState("");
  const [validatedCode, setValidatedCode] = useState<string | null>(null);
  const [targetPublicKey, setTargetPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("enter-code");

  useEffect(() => {
    AuthClient.create({ keyType: "Ed25519" }).then((client) => {
      setAuthClient(client);
    });
  }, []);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = shortCode.toUpperCase().trim();
    if (code.length !== 6) {
      setError("Code must be 6 characters");
      return;
    }

    try {
      const agent = HttpAgent.createSync({
        host: window.location.origin,
        rootKey: canisterEnv?.IC_ROOT_KEY,
      });
      const actor = createActor(canisterId, { agent });
      const result = await actor.lookup_code(code);

      if (result === null) {
        setError("Code not found or expired. Please try again.");
        return;
      }

      setValidatedCode(code);
      setTargetPublicKey(result);
      setStep("login");

      // Immediately trigger II login instead of requiring a button press
      authClient!.login({
        identityProvider: getIdentityProviderUrl(),
        maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000),
        onSuccess: async () => {
          const delegation = await createDelegationForKey(
            authClient!,
            result
          );
          storeDelegationForCode(delegation, code);
        },
        onError: (loginError) => {
          console.error("Login failed:", loginError);
        },
      });
    } catch (err) {
      console.error("Lookup failed:", err);
      setError("Failed to look up code. Please try again.");
    }
  }

  function handleLogin() {
    if (!authClient || !targetPublicKey || !validatedCode) return;
    authClient.login({
      identityProvider: getIdentityProviderUrl(),
      maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000),
      onSuccess: async () => {
        const delegation = await createDelegationForKey(
          authClient,
          targetPublicKey
        );
        storeDelegationForCode(delegation, validatedCode);
      },
      onError: (error) => {
        console.error("Login failed:", error);
      },
    });
  }

  function storeDelegationForCode(delegation: JsonnableDelegationChain | null, code: string) {
    if (!authClient || !delegation) return;

    const identity = authClient.getIdentity();
    const agent = HttpAgent.createSync({
      identity,
      host: window.location.origin,
      rootKey: canisterEnv?.IC_ROOT_KEY,
    });

    const actor = createActor(canisterId, { agent });

    actor.store_delegation(code, delegation).then(async () => {
      console.log("Delegation stored with code: %s", code);
      setStep("finished");
      if (!debugParam) {
        await handleLogout();
        setTimeout(() => window.close(), 3000);
      }
    });
  }

  async function handleLogout() {
    if (!authClient) return;
    await authClient.logout();
  }

  return (
    <main className="page">
      <section className="panel">
        <h1 className="title">icp-cli Login</h1>

        {step === "enter-code" && (
          <>
            <p className="subtitle">
              Enter the one time code displayed in your terminal.
            </p>
            <form className="form" onSubmit={handleCodeSubmit}>
              <div className="controls">
                <input
                  className="input"
                  type="text"
                  value={shortCode}
                  onChange={(e) =>
                    setShortCode(
                      e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6)
                    )
                  }
                  placeholder="ABC123"
                  maxLength={6}
                  autoFocus
                />
                <button
                  className="button"
                  type="submit"
                  disabled={shortCode.length !== 6}
                >
                  Submit
                </button>
              </div>
              {error && (
                <p className="subtitle" style={{ color: "var(--accent)" }}>
                  {error}
                </p>
              )}
            </form>
          </>
        )}

        {step === "login" && (
          <>
            <p className="subtitle">Sign in with Internet Identity if the popup didn't open.</p>
            <button
              className="button"
              onClick={handleLogin}
              disabled={!authClient}
            >
              Sign in
            </button>
          </>
        )}

        {step === "finished" && (
          <>
            {debugParam ? (
              <>
                <p className="subtitle">Debug is on, sign out manually</p>
                <button className="button" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <p className="subtitle">You can close this window...</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default CliLogin;
