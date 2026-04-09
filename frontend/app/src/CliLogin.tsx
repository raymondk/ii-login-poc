import { useState, useEffect } from "react";
import { AuthClient } from "@icp-sdk/auth/client";
import { parseCliLoginParams, performCliLogin, type Step } from "./cli-auth";
import "./App.css";

const cliParams = parseCliLoginParams(window.location.hash);

function CliLogin() {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [step, setStep] = useState<Step>("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AuthClient.create({ keyType: "Ed25519" }).then(setAuthClient);
  }, []);

  if (!cliParams) {
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
    if (!authClient || !cliParams) return;
    setError(null);

    performCliLogin(authClient, cliParams, {
      onSigningIn: () => setStep("signing-in"),
      onSending: () => setStep("sending"),
      onFinished: () => {
        authClient.logout();
        setStep("finished");
        setTimeout(() => window.close(), 2000);
      },
      onError: (message) => {
        setError(message);
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
              <p className="subtitle">Done! You can close this window.</p>
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
