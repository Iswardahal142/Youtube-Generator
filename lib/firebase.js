// ══════════════════════════════════════════════════
//  KAALI RAAT — Firebase + Google Auth (Next.js)
// ══════════════════════════════════════════════════

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton init (Next.js hot reload ke liye)
const _app     = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth     = getAuth(_app);
const db       = getFirestore(_app);
const provider = new GoogleAuthProvider();

// Whitelist — khali = sab allow
const ALLOWED_EMAILS = [];

// ── Path Helpers ─────────────────────────────────
function uDoc(uid, ...path) {
  return doc(db, 'users', uid, ...path);
}
function uCol(uid, ...path) {
  return collection(db, 'users', uid, ...path);
}

// ── Auth ─────────────────────────────────────────
export { auth, provider, ALLOWED_EMAILS, signInWithPopup, signOut, onAuthStateChanged };

// ── STATE ────────────────────────────────────────
export async function db_saveState(uid, stateObj) {
  try {
    await setDoc(uDoc(uid, 'meta', 'state'), stateObj, { merge: true });
  } catch (e) {
    console.warn('[db] saveState fail', e);
  }
}

export async function db_loadState(uid) {
  try {
    const snap = await getDoc(uDoc(uid, 'meta', 'state'));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// ── EPISODES ─────────────────────────────────────
export async function db_saveEpisode(uid, ep) {
  try {
    const epId = ep.id || Date.now().toString();
    const ref  = uDoc(uid, 'episodes', epId);
    await setDoc(ref, { ...ep, id: epId }, { merge: true });
  } catch (e) {
    console.warn('[db] saveEpisode fail', e);
  }
}

export async function db_getEpisodes(uid) {
  try {
    const q    = query(uCol(uid, 'episodes'), orderBy('savedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch {
    try {
      const snap = await getDocs(uCol(uid, 'episodes'));
      const eps  = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      return eps.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } catch {
      return [];
    }
  }
}

export async function db_getEpisode(uid, epId) {
  try {
    const snap = await getDoc(uDoc(uid, 'episodes', epId));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch {
    return null;
  }
}

export async function db_deleteEpisode(uid, epId) {
  try {
    await deleteDoc(uDoc(uid, 'episodes', epId));
  } catch (e) {
    console.warn('[db] deleteEpisode fail', e);
  }
}

export async function db_deleteByTitle(uid, title) {
  try {
    const eps      = await db_getEpisodes(uid);
    const toDelete = eps.filter(e => (e.title || 'Untitled') === title);
    await Promise.all(toDelete.map(e => deleteDoc(uDoc(uid, 'episodes', e.id))));
  } catch (e) {
    console.warn('[db] deleteByTitle fail', e);
  }
}

// ── USED IDEAS ────────────────────────────────────
export async function db_getUsedIdeas(uid) {
  try {
    const snap = await getDoc(uDoc(uid, 'meta', 'usedIdeas'));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch {
    return [];
  }
}

export async function db_saveUsedIdeas(uid, list) {
  try {
    await setDoc(uDoc(uid, 'meta', 'usedIdeas'), { list }, { merge: true });
  } catch (e) {
    console.warn('[db] saveUsedIdeas fail', e);
  }
}

// ── SEASONS ──────────────────────────────────────
export async function db_getSeasons(uid) {
  try {
    const snap = await getDocs(uCol(uid, 'seasons'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch {
    return [];
  }
}

export async function db_saveSeason(uid, seasonId, data) {
  try {
    await setDoc(uDoc(uid, 'seasons', seasonId), data, { merge: true });
  } catch (e) {
    console.warn('[db] saveSeason fail', e);
  }
}

export async function db_getSeason(uid, seasonId) {
  try {
    const snap = await getDoc(uDoc(uid, 'seasons', seasonId));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
