export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const REQUIRED_FIREBASE_KEYS: Array<keyof FirebasePublicConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

function readEnv(name: string): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.[name] ?? '').trim();
  } catch {
    return '';
  }
}

export function getFirebasePublicConfig(): FirebasePublicConfig {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    databaseURL: readEnv('VITE_FIREBASE_DATABASE_URL'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
  };
}

export function getMissingFirebaseKeys(): string[] {
  const cfg = getFirebasePublicConfig();
  const keyMap: Record<keyof FirebasePublicConfig, string> = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    databaseURL: 'VITE_FIREBASE_DATABASE_URL',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'VITE_FIREBASE_APP_ID',
  };

  return REQUIRED_FIREBASE_KEYS.filter((k) => !cfg[k]).map((k) => keyMap[k]);
}

export function isFirebaseConfigured(): boolean {
  return getMissingFirebaseKeys().length === 0;
}
