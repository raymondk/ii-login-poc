import { useState, useEffect } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import {
  DelegationChain,
  DelegationIdentity,
  type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import type { PublicKey, DerEncodedPublicKey } from "@icp-sdk/core/agent";
import { getIdentityProviderUrl, base64ToBytes } from "./utils";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const publicKeyParam = params.get("public_key");
const callbackParam = params.get("callback");
const debugParam = params.has("debug");

type Step = "ready" | "signing-in" | "sending" | "finished" | "error";

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

  return delegationChain.toJSON();
}

function CliLogin() {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [step, setStep] = useState<Step>("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AuthClient.create({ keyType: "Ed25519" }).then(setAuthClient);
  }, []);

  if (!publicKeyParam || !callbackParam) {
    return (
      <main className="page">
        <section className="panel">
          <h1 className="title">icp-cli Login</h1>
          <p className="subtitle" style={{ color: "var(--accent)" }}>
            Missing required URL parameters: <code>public_key</code> and <code>callback</code>
          </p>
        </section>
      </main>
    );
  }

  function handleLogin() {
    if (!authClient) return;
    setStep("signing-in");
    setError(null);

    authClient.login({
      identityProvider: getIdentityProviderUrl(),
      maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000),
      onSuccess: async () => {
        setStep("sending");
        try {
          const delegation = await createDelegationForKey(authClient, publicKeyParam!);
          if (!delegation) {
            setError("Failed to create delegation chain.");
            setStep("error");
            return;
          }

          const response = await fetch(callbackParam!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(delegation),
          });

          if (!response.ok) {
            setError(`Callback failed: ${response.status} ${response.statusText}`);
            setStep("error");
            return;
          }

          setStep("finished");
          if (!debugParam) {
            await authClient.logout();
            setTimeout(() => window.close(), 3000);
          }
        } catch (err) {
          console.error("Delegation/callback failed:", err);
          setError(`Failed to send delegation: ${err}`);
          setStep("error");
        }
      },
      onError: (loginError) => {
        console.error("Login failed:", loginError);
        setError(`Sign-in failed: ${loginError}`);
        setStep("error");
      },
    });
  }

  return (
    <main className="page">
      <section className="panel">
        <h1 className="title">icp-cli Login</h1>

        {step === "ready" && (
          <>
            <p className="subtitle">
              Sign in with Internet Identity to authorize the CLI.
            </p>
            <button
              className="button"
              onClick={handleLogin}
              disabled={!authClient}
            >
              Sign in with Internet Identity
            </button>
          </>
        )}

        {step === "signing-in" && (
          <p className="subtitle">Waiting for Internet Identity...</p>
        )}

        {step === "sending" && (
          <p className="subtitle">Sending delegation to CLI...</p>
        )}

        {step === "finished" && (
          <>
            {debugParam ? (
              <>
                <p className="subtitle">Delegation sent. Debug mode — sign out manually.</p>
                <button className="button" onClick={() => authClient?.logout()}>
                  Sign out
                </button>
              </>
            ) : (
              <p className="subtitle">Done! You can close this window.</p>
            )}
          </>
        )}

        {step === "error" && (
          <>
            <p className="subtitle" style={{ color: "var(--accent)" }}>
              {error}
            </p>
            <button className="button" onClick={handleLogin}>
              Try again
            </button>
          </>
        )}
      </section>
    </main>
  );
}

export default CliLogin;
