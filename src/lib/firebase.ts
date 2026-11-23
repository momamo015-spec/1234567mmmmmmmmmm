import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { BookmarkEntry, EngineMode, SearchHistoryEntry, SearchTab, ShortcutEntry, ThemeMode } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
    'ai-studio-3bcd67be-f226-41f5-9c34-3fa44a1bd086'
);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

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
testConnection();

export function initFirebaseAuth(
  onAuthChange: (user: User | null, driveToken: string | null) => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
      onAuthChange(null, null);
    } else if (!isSigningIn) {
      onAuthChange(user, cachedAccessToken);
    }
  });
}

export async function signInWithGoogleForNova(): Promise<{
  user: User;
  accessToken: string | null;
  idToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    const idToken = await result.user.getIdToken();
    return { user: result.user, accessToken: cachedAccessToken, idToken };
  } finally {
    isSigningIn = false;
  }
}

export function getCachedDriveToken(): string | null {
  return cachedAccessToken;
}

export async function signOutFirebase(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `item_${Date.now()}`;
}

export async function syncFirestoreUserProfile(
  user: User,
  prefs: { avatarColor: string; preferredEngine: EngineMode; theme: ThemeMode }
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: (user.email || 'user@nova.com').slice(0, 256),
        displayName: (user.displayName || 'مستخدم نوفا').slice(0, 120),
        avatarColor: prefs.avatarColor.slice(0, 32),
        preferredEngine: prefs.preferredEngine,
        theme: prefs.theme,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email: (user.email || 'user@nova.com').slice(0, 256),
        displayName: (user.displayName || 'مستخدم نوفا').slice(0, 120),
        avatarColor: prefs.avatarColor.slice(0, 32),
        preferredEngine: prefs.preferredEngine,
        theme: prefs.theme,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function saveFirestoreHistory(
  uid: string,
  entry: { query: string; engineMode: EngineMode; tab: SearchTab }
): Promise<void> {
  const id = sanitizeId(`h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `users/${uid}/history/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'history', id), {
      uid,
      query: entry.query.slice(0, 500),
      engineMode: entry.engineMode,
      tab: entry.tab,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadFirestoreHistory(uid: string): Promise<SearchHistoryEntry[]> {
  const path = `users/${uid}/history`;
  try {
    const q = query(collection(db, 'users', uid, 'history'), where('uid', '==', uid), limit(30));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          query: String(data.query || ''),
          engineMode: (data.engineMode as EngineMode) || 'hybrid',
          tab: (data.tab as SearchTab) || 'all',
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveFirestoreBookmark(
  uid: string,
  bookmark: Omit<BookmarkEntry, 'id' | 'createdAt'>
): Promise<string> {
  const id = sanitizeId(`b_${btoa(unescape(encodeURIComponent(bookmark.url))).replace(/=/g, '').slice(0, 80)}`);
  const path = `users/${uid}/bookmarks/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'bookmarks', id), {
      uid,
      title: bookmark.title.slice(0, 300),
      url: bookmark.url.slice(0, 2000),
      snippet: bookmark.snippet.slice(0, 1000),
      displayLink: bookmark.displayLink.slice(0, 256),
      sourceType: bookmark.sourceType.slice(0, 32),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFirestoreBookmark(uid: string, bookmarkId: string): Promise<void> {
  const safeId = sanitizeId(bookmarkId);
  const path = `users/${uid}/bookmarks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookmarks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadFirestoreBookmarks(uid: string): Promise<BookmarkEntry[]> {
  const path = `users/${uid}/bookmarks`;
  try {
    const q = query(collection(db, 'users', uid, 'bookmarks'), where('uid', '==', uid), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title || ''),
          url: String(data.url || ''),
          snippet: String(data.snippet || ''),
          displayLink: String(data.displayLink || ''),
          sourceType: (data.sourceType as BookmarkEntry['sourceType']) || 'google',
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveFirestoreShortcut(
  uid: string,
  shortcut: Omit<ShortcutEntry, 'id'>
): Promise<string> {
  const id = sanitizeId(`s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${uid}/shortcuts/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'shortcuts', id), {
      uid,
      title: shortcut.title.slice(0, 80),
      url: shortcut.url.slice(0, 1000),
      iconColor: shortcut.iconColor.slice(0, 32),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
