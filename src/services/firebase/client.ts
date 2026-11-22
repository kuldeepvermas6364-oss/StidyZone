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
  const cfg = firebaseConfig as any;
  return Boolean(
    cfg?.projectId &&
      cfg?.apiKey &&
      cfg?.appId &&
      cfg?.firestoreDatabaseId
  );
}

export function getFirebaseServiceReadiness(): FirebaseServiceReadiness {
  const appletReady = isAppletFirebaseProvisioned();
  const envReady = isFirebaseConfigured();
  const envCfg = getFirebasePublicConfig();
  const cfg = firebaseConfig as any;

  return {
    configured: appletReady || envReady,
    source: appletReady ? 'applet-config' : envReady ? 'env' : 'none',
    missingEnvKeys: appletReady ? [] : getMissingFirebaseKeys(),
    projectId: appletReady ? cfg.projectId : envCfg.projectId || null,
    firestoreDatabaseId: appletReady ? cfg.firestoreDatabaseId : null,
    servicesActive: appletReady ? ['auth', 'firestore'] : [],
    servicesPlanned: ['realtimeDatabase', 'storage'],
  };
}
