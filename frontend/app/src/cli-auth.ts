import { AuthClient } from "@icp-sdk/auth/client";
import {
  DelegationChain,
  DelegationIdentity,
  type JsonnableDelegationChain,
} from "@icp-sdk/core/identity";
import type { PublicKey, DerEncodedPublicKey } from "@icp-sdk/core/agent";
import { getIdentityProviderUrl, base64ToBytes } from "./utils";

export type Step = "ready" | "signing-in" | "sending" | "finished" | "error";

export interface CliLoginParams {
  publicKey: string;
  callback: string;
}

export interface CliLoginCallbacks {
  onSigningIn: () => void;
  onSending: () => void;
  onFinished: () => void;
  onError: (message: string) => void;
}

export function parseCliLoginParams(hash: string): CliLoginParams | null {
  const params = new URLSearchParams(hash.slice(1));
  const publicKey = params.get("public_key");
  const callback = params.get("callback");
  if (!publicKey || !callback) return null;
  return { publicKey, callback };
}

const DEFAULT_EXPIRATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export async function createDelegationForKey(
  authClient: AuthClient,
  targetPublicKeyBase64: string,
  expirationMs: number = DEFAULT_EXPIRATION_MS
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
    new Date(Date.now() + expirationMs),
    { previous: existingChain }
  );

  return delegationChain.toJSON();
}

export function performCliLogin(
  authClient: AuthClient,
  params: CliLoginParams,
  callbacks: CliLoginCallbacks,
  expirationMs: number = DEFAULT_EXPIRATION_MS
): void {
  callbacks.onSigningIn();

  authClient.login({
    identityProvider: getIdentityProviderUrl(),
    maxTimeToLive: BigInt(expirationMs) * BigInt(1_000_000),
    onSuccess: async () => {
      callbacks.onSending();
      try {
        const delegation = await createDelegationForKey(authClient, params.publicKey, expirationMs);
        if (!delegation) {
          callbacks.onError("Failed to create delegation chain.");
          return;
        }

        const response = await fetch(params.callback, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(delegation),
        });

        if (!response.ok) {
          callbacks.onError(`Callback failed: ${response.status} ${response.statusText}`);
          return;
        }

        callbacks.onFinished();
      } catch (err) {
        console.error("Delegation/callback failed:", err);
        callbacks.onError(`Failed to send delegation: ${err}`);
      }
    },
    onError: (loginError) => {
      console.error("Login failed:", loginError);
      callbacks.onError(`Sign-in failed: ${loginError}`);
    },
  });
}
