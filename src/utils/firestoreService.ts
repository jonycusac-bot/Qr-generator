import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { QRProject, AppUser, ScanEvent } from '../types';
import { INITIAL_PROJECTS, INITIAL_USERS, INITIAL_SCANS } from '../data/initialData';

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
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

// Collections references
const PROJECTS_COLLECTION = 'projects';
const USERS_COLLECTION = 'users';
const SCANS_COLLECTION = 'scans';

// Real-time subscribers
export function subscribeToProjects(
  onProjects: (projects: QRProject[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, PROJECTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: QRProject[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as QRProject);
      });
      onProjects(items);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, PROJECTS_COLLECTION);
    }
  );
}

export function subscribeToUsers(
  onUsers: (users: AppUser[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, USERS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as AppUser);
      });
      onUsers(items);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, USERS_COLLECTION);
    }
  );
}

export function subscribeToScans(
  onScans: (scans: ScanEvent[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, SCANS_COLLECTION), orderBy('scannedAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ScanEvent[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ScanEvent);
      });
      onScans(items);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, SCANS_COLLECTION);
    }
  );
}

// Write functions
export async function saveProjectFirestore(project: QRProject): Promise<void> {
  const path = `${PROJECTS_COLLECTION}/${project.id}`;
  try {
    await setDoc(doc(db, PROJECTS_COLLECTION, project.id), project);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProjectFirestore(projectId: string): Promise<void> {
  const path = `${PROJECTS_COLLECTION}/${projectId}`;
  try {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveUserFirestore(user: AppUser): Promise<void> {
  const path = `${USERS_COLLECTION}/${user.id}`;
  try {
    await setDoc(doc(db, USERS_COLLECTION, user.id), user);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserFirestore(userId: string): Promise<void> {
  const path = `${USERS_COLLECTION}/${userId}`;
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordScanFirestore(scan: ScanEvent): Promise<void> {
  const path = `${SCANS_COLLECTION}/${scan.id}`;
  try {
    await setDoc(doc(db, SCANS_COLLECTION, scan.id), scan);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Seed initial data if Firestore is empty
export async function seedFirestoreIfEmpty(): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, PROJECTS_COLLECTION));
    if (snap.empty) {
      console.log('[Firebase] Seeding initial projects, users and scans...');
      for (const p of INITIAL_PROJECTS) {
        await setDoc(doc(db, PROJECTS_COLLECTION, p.id), p);
      }
      for (const u of INITIAL_USERS) {
        await setDoc(doc(db, USERS_COLLECTION, u.id), u);
      }
      for (const s of INITIAL_SCANS) {
        await setDoc(doc(db, SCANS_COLLECTION, s.id), s);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[Firebase] Could not seed data:', error);
    return false;
  }
}
