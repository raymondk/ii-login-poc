export function getIdentityProviderUrl() {
	const host = window.location.hostname;
	const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
	if (isLocal) {
		return 'http://id.ai.localhost:8000';
	}
	return 'https://id.ai';
}
