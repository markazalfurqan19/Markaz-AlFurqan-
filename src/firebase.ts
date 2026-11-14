import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const GOOGLE_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

const app = initializeApp(firebaseConfig);
const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

GOOGLE_SHEETS_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Strict in-memory Google OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedGoogleAccessToken: string | null = null;
const tokenListeners = new Set<(hasToken: boolean) => void>();

function notifyTokenListeners() {
  const hasToken = Boolean(cachedGoogleAccessToken);
  tokenListeners.forEach((listener) => listener(hasToken));
}

export function setCachedGoogleAccessToken(token: string | null) {
  cachedGoogleAccessToken = token || null;
  notifyTokenListeners();
}

export function getCachedGoogleAccessToken(): string | null {
  return cachedGoogleAccessToken;
}

export function clearCachedGoogleAccessToken() {
  cachedGoogleAccessToken = null;
  notifyTokenListeners();
}

export function subscribeGoogleAccessToken(listener: (hasToken: boolean) => void): () => void {
  tokenListeners.add(listener);
  listener(Boolean(cachedGoogleAccessToken));
  return () => {
    tokenListeners.delete(listener);
  };
}

// Clear in-memory token whenever user signs out
onAuthStateChanged(auth, (firebaseUser) => {
  if (!firebaseUser) {
    clearCachedGoogleAccessToken();
  }
});

/**
 * Must be invoked directly from a user button click to acquire/refresh the Google Sheets token.
 */
export async function connectGoogleSheets(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Failed to obtain Google Sheets access token.');
  }
  setCachedGoogleAccessToken(credential.accessToken);
  return credential.accessToken;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
