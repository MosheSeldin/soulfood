import { dev } from '$app/environment';
import { db } from './db';
import { users, sessions } from './db/schema';
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'sf_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function generateId(): string {
	return crypto.randomUUID();
}

function randomSalt(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Salted hash. */
async function hashPassword(password: string, salt: string): Promise<string> {
	return sha256Hex(`${salt}:${password}`);
}

/** Constant-time comparison of equal-length hex strings. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function verifyPassword(password: string, hash: string, salt: string | null): Promise<boolean> {
	if (salt) return safeEqual(await hashPassword(password, salt), hash);
	// Legacy unsalted hash (pre-migration) — verify the old way; caller upgrades on success.
	return safeEqual(await sha256Hex(password), hash);
}

export async function setupPassword(password: string): Promise<void> {
	const allUsers = await db.select().from(users);
	for (const user of allUsers) {
		if (!user.passwordHash) {
			const salt = randomSalt();
			await db
				.update(users)
				.set({ passwordHash: await hashPassword(password, salt), passwordSalt: salt })
				.where(eq(users.id, user.id));
		}
	}
}

export async function login(
	name: string,
	password: string,
	cookies: Cookies
): Promise<{ success: boolean; error?: string }> {
	const allUsers = await db.select().from(users);

	// First-time setup: if no passwords set, set the password
	const hasPasswords = allUsers.some((u) => u.passwordHash !== '');
	if (!hasPasswords) {
		await setupPassword(password);
		// Re-fetch after setting
		const updatedUsers = await db.select().from(users);
		const user = updatedUsers.find((u) => u.name === name);
		if (!user) return { success: false, error: 'משתמש לא נמצא' };
		return createSession(user.id, cookies);
	}

	const user = allUsers.find((u) => u.name === name);
	if (!user) return { success: false, error: 'משתמש לא נמצא' };

	const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
	if (!valid) return { success: false, error: 'סיסמה שגויה' };

	// Upgrade legacy unsalted hashes to salted on successful login.
	if (!user.passwordSalt) {
		const salt = randomSalt();
		await db
			.update(users)
			.set({ passwordHash: await hashPassword(password, salt), passwordSalt: salt })
			.where(eq(users.id, user.id));
	}

	return createSession(user.id, cookies);
}

async function createSession(
	userId: string,
	cookies: Cookies
): Promise<{ success: boolean }> {
	const sessionId = generateId();
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

	await db.insert(sessions).values({ id: sessionId, userId, expiresAt });

	cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev, // HTTPS-only in production
		maxAge: SESSION_MAX_AGE
	});

	return { success: true };
}

export async function getSession(cookies: Cookies): Promise<{ userId: string; name: string } | null> {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return null;

	const result = await db
		.select({ userId: sessions.userId, name: users.name, expiresAt: sessions.expiresAt })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (result.length === 0) return null;

	const session = result[0];
	if (session.expiresAt < new Date()) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}

	return { userId: session.userId, name: session.name };
}

export async function logout(cookies: Cookies): Promise<void> {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function getUserNames(): Promise<string[]> {
	const allUsers = await db.select({ name: users.name }).from(users);
	return allUsers.map((u) => u.name);
}
