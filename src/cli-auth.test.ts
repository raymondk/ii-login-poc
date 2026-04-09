import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseCliLoginParams, createDelegationForKey, performCliLogin } from './cli-auth.js';
import type { CliLoginCallbacks, CliLoginParams, CliLoginOptions } from './cli-auth.js';
import { DelegationIdentity } from '@icp-sdk/core/identity';
import type { AuthClient } from '@icp-sdk/auth/client';

// --- parseCliLoginParams ---

describe('parseCliLoginParams', () => {
	it('parses valid hash with both params', () => {
		const result = parseCliLoginParams('#public_key=abc123&callback=http://localhost:3000/cb');
		expect(result).toEqual({
			publicKey: 'abc123',
			callback: 'http://localhost:3000/cb',
		});
	});

	it('returns null when public_key is missing', () => {
		expect(parseCliLoginParams('#callback=http://localhost:3000/cb')).toBeNull();
	});

	it('returns null when callback is missing', () => {
		expect(parseCliLoginParams('#public_key=abc123')).toBeNull();
	});

	it('returns null for empty hash', () => {
		expect(parseCliLoginParams('#')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseCliLoginParams('')).toBeNull();
	});

	it('handles URL-encoded values', () => {
		const result = parseCliLoginParams(
			'#public_key=a%2Bb%2Fc&callback=http%3A%2F%2Flocalhost%3A3000%2Fcb',
		);
		expect(result).toEqual({
			publicKey: 'a+b/c',
			callback: 'http://localhost:3000/cb',
		});
	});
});

// --- createDelegationForKey ---

describe('createDelegationForKey', () => {
	it('returns null when identity is not a DelegationIdentity', async () => {
		const mockClient = {
			getIdentity: () => ({ not: 'a delegation identity' }),
		} as unknown as AuthClient;

		const result = await createDelegationForKey(mockClient, 'dGVzdA');
		expect(result).toBeNull();
	});

	it('creates a delegation chain for a valid DelegationIdentity', async () => {
		const mockJson = { delegations: [], publicKey: 'mock' };
		const mockChain = { toJSON: () => mockJson };
		const mockDelegation = { some: 'delegation' };

		const mockIdentity = Object.create(DelegationIdentity.prototype);
		Object.assign(mockIdentity, {
			getDelegation: () => mockDelegation,
		});

		const mockClient = {
			getIdentity: () => mockIdentity,
		} as unknown as AuthClient;

		const { DelegationChain } = await import('@icp-sdk/core/identity');
		const createSpy = vi.spyOn(DelegationChain, 'create').mockResolvedValue(mockChain as any);

		const result = await createDelegationForKey(mockClient, 'dGVzdA', 1000);

		expect(result).toEqual(mockJson);
		expect(createSpy).toHaveBeenCalledWith(
			mockIdentity,
			expect.objectContaining({ toDer: expect.any(Function) }),
			expect.any(Date),
			{ previous: mockDelegation },
		);

		createSpy.mockRestore();
	});
});

// --- performCliLogin ---

describe('performCliLogin', () => {
	let callbacks: CliLoginCallbacks;
	let params: CliLoginParams;
	let options: CliLoginOptions;

	beforeEach(() => {
		callbacks = {
			onSigningIn: vi.fn(),
			onSending: vi.fn(),
			onFinished: vi.fn(),
			onError: vi.fn(),
		};
		params = { publicKey: 'dGVzdA', callback: 'http://localhost:3000/cb' };
		options = { identityProvider: 'https://identity.ic0.app' };
	});

	it('calls onSigningIn immediately and passes identityProvider to login', () => {
		const loginFn = vi.fn();
		const mockClient = { login: loginFn } as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, options);

		expect(callbacks.onSigningIn).toHaveBeenCalled();
		expect(loginFn).toHaveBeenCalledWith(
			expect.objectContaining({
				identityProvider: 'https://identity.ic0.app',
				maxTimeToLive: BigInt(8 * 60 * 60 * 1000) * BigInt(1_000_000),
			}),
		);
	});

	it('uses custom expirationMs for maxTimeToLive', () => {
		const loginFn = vi.fn();
		const mockClient = { login: loginFn } as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, { ...options, expirationMs: 5000 });

		expect(loginFn).toHaveBeenCalledWith(
			expect.objectContaining({
				maxTimeToLive: BigInt(5000) * BigInt(1_000_000),
			}),
		);
	});

	it('calls onError when login fails', () => {
		const mockClient = {
			login: vi.fn((opts: any) => opts.onError('auth failed')),
		} as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, options);

		expect(callbacks.onError).toHaveBeenCalledWith('Sign-in failed: auth failed');
	});

	it('calls onSending then onFinished on successful login and callback', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(null, { status: 200 }),
		);

		const mockJson = { delegations: [], publicKey: 'mock' };
		const mockChain = { toJSON: () => mockJson };
		const mockDelegation = { some: 'delegation' };
		const mockIdentity = Object.create(DelegationIdentity.prototype);
		Object.assign(mockIdentity, { getDelegation: () => mockDelegation });

		const { DelegationChain } = await import('@icp-sdk/core/identity');
		const createSpy = vi.spyOn(DelegationChain, 'create').mockResolvedValue(mockChain as any);

		let onSuccessFn: () => Promise<void>;
		const mockClient = {
			login: vi.fn((opts: any) => { onSuccessFn = opts.onSuccess; }),
			getIdentity: () => mockIdentity,
		} as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, options);
		await onSuccessFn!();

		expect(callbacks.onSending).toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/cb', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(mockJson),
		});
		expect(callbacks.onFinished).toHaveBeenCalled();

		fetchSpy.mockRestore();
		createSpy.mockRestore();
	});

	it('calls onError when delegation creation returns null', async () => {
		// Identity is not a DelegationIdentity → createDelegationForKey returns null
		const mockClient = {
			login: vi.fn((opts: any) => { opts.onSuccess(); }),
			getIdentity: () => ({ not: 'delegation' }),
		} as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, options);
		// onSuccess is sync-called but the inner async needs a tick
		await vi.waitFor(() => {
			expect(callbacks.onError).toHaveBeenCalledWith('Failed to create delegation chain.');
		});
	});

	it('calls onError when fetch returns non-ok response', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(null, { status: 500, statusText: 'Internal Server Error' }),
		);

		const mockJson = { delegations: [], publicKey: 'mock' };
		const mockChain = { toJSON: () => mockJson };
		const mockIdentity = Object.create(DelegationIdentity.prototype);
		Object.assign(mockIdentity, { getDelegation: () => ({}) });

		const { DelegationChain } = await import('@icp-sdk/core/identity');
		const createSpy = vi.spyOn(DelegationChain, 'create').mockResolvedValue(mockChain as any);

		let onSuccessFn: () => Promise<void>;
		const mockClient = {
			login: vi.fn((opts: any) => { onSuccessFn = opts.onSuccess; }),
			getIdentity: () => mockIdentity,
		} as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, options);
		await onSuccessFn!();

		expect(callbacks.onError).toHaveBeenCalledWith('Callback failed: 500 Internal Server Error');

		fetchSpy.mockRestore();
		createSpy.mockRestore();
	});

	it('calls onError when fetch throws', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

		const mockJson = { delegations: [], publicKey: 'mock' };
		const mockChain = { toJSON: () => mockJson };
		const mockIdentity = Object.create(DelegationIdentity.prototype);
		Object.assign(mockIdentity, { getDelegation: () => ({}) });

		const { DelegationChain } = await import('@icp-sdk/core/identity');
		const createSpy = vi.spyOn(DelegationChain, 'create').mockResolvedValue(mockChain as any);

		let onSuccessFn: () => Promise<void>;
		const mockClient = {
			login: vi.fn((opts: any) => { onSuccessFn = opts.onSuccess; }),
			getIdentity: () => mockIdentity,
		} as unknown as AuthClient;

		performCliLogin(mockClient, params, callbacks, options);
		await onSuccessFn!();

		expect(callbacks.onError).toHaveBeenCalledWith('Failed to send delegation: Error: network down');

		fetchSpy.mockRestore();
		createSpy.mockRestore();
	});
});
