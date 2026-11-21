import firebaseConfig from '../../../firebase-applet-config.json';
import { getFirebasePublicConfig, getMissingFirebaseKeys, isFirebaseConfigured } from '../../config/env';

export interface FirebaseServiceReadiness {
  configured: boolean;
  source: 'applet-config' | 'env' | 'none';
  missingEnvKeys: string[];
  projectId: string | null;
  firestoreDatabaseId: string | null;
  servicesActive: Array<'auth' | 'firestore'>;
  servicesPlanned: Array<'realtimeDatabase' | 'storage'>;
}

export function isAppletFirebaseProvisioned(): boolean {
  return Boolean(
    firebaseConfig?.projectId &&
      firebaseConfig?.apiKey &&
      firebaseConfig?.appId &&
      firebaseConfig?.firestoreDatabaseId
  );
}

export function getFirebaseServiceReadiness(): FirebaseServiceReadiness {
  const appletReady = isAppletFirebaseProvisioned();
  const envReady = isFirebaseConfigured();
  const envCfg = getFirebasePublicConfig();

  return {
    configured: appletReady || envReady,
    source: appletReady ? 'applet-config' : envReady ? 'env' : 'none',
    missingEnvKeys: appletReady ? [] : getMissingFirebaseKeys(),
    projectId: appletReady ? firebaseConfig.projectId : envCfg.projectId || null,
    firestoreDatabaseId: appletReady ? firebaseConfig.firestoreDatabaseId : null,
    servicesActive: appletReady ? ['auth', 'firestore'] : [],
    servicesPlanned: ['realtimeDatabase', 'storage'],
  };
}
