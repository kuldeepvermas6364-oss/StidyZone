import { auth } from '../../firebase';

let inMemoryFoundationToken: string | null = null;
let inMemoryFoundationUid: string | null = null;

export function clearServerSessionToken(): void {
  inMemoryFoundationToken = null;
  inMemoryFoundationUid = null;
}

export async function ensureFoundationServerToken(uid: string, email: string): Promise<string | null> {
  if (inMemoryFoundationToken && inMemoryFoundationUid === uid) {
    return inMemoryFoundationToken;
  }
  try {
    const resp = await fetch('/api/auth/session-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { token?: string };
    if (data.token) {
      inMemoryFoundationToken = data.token;
      inMemoryFoundationUid = uid;
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getActiveBearerToken(
  sessionMode?: 'firebase' | 'local-foundation',
  uid?: string,
  email?: string
): Promise<string | null> {
  if (sessionMode === 'firebase' && auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }
  if (sessionMode === 'local-foundation' && uid && email) {
    return ensureFoundationServerToken(uid, email);
  }
  return null;
}
