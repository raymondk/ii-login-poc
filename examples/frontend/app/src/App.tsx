import { AuthClient } from '@icp-sdk/auth/client';
import { getIdentityProviderUrl } from './utils';
import { useEffect, useState } from 'react';
import './App.css';

function App() {
	const [authClient, setAuthClient] = useState<AuthClient | null>(null);
	const [principal, setPrincipal] = useState<string | null>(null);

	useEffect(() => {
		AuthClient.create({ keyType: 'Ed25519' }).then(async (client) => {
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
			maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000),
			onSuccess: () => {
				const identity = authClient.getIdentity();
				setPrincipal(identity.getPrincipal().toText());
			},
			onError: (error) => {
				console.error('Login failed:', error);
			},
		});
	}

	async function handleLogout() {
		if (!authClient) return;
		await authClient.logout();
		setPrincipal(null);
	}

	const isAuthenticated = principal !== null;

	return (
		<main className="page">
			<section className="panel">
				<h1 className="title">icp-cli Login</h1>
				{!isAuthenticated ? (
					<>
						<p className="subtitle">Sign in with Internet Identity.</p>
						<button type="button" className="button" onClick={handleLogin} disabled={!authClient}>
							Sign in
						</button>
					</>
				) : (
					<>
						<p className="subtitle">
							Signed in as: <code>{principal}</code>
						</p>
						<button type="button" className="button logout-button" onClick={handleLogout}>
							Sign out
						</button>
					</>
				)}
			</section>
		</main>
	);
}

export default App;
