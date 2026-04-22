'use client';

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
  apiKey:            "AIzaSyC4G3cBS6fTmi7PXRrCbQPIkEbr-bh_470",
  authDomain:        "fir-c929f.firebaseapp.com",
  projectId:         "fir-c929f",
  storageBucket:     "fir-c929f.firebasestorage.app",
  messagingSenderId: "82713990557",
  appId:             "1:82713990557:web:d4586900ad445cb8a2cb74",
};

const ALLOWED_EMAILS = [];

const _app     = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
const auth     = getAuth(_app);
const db       = getFirestore(_app);
const provider = new GoogleAuthProvider();

function uDoc(uid, ...path) { return doc(db, 'users', uid, ...path); }
function uCol(uid, ...path) { return collection(db, 'users', uid, ...path); }

export { auth, provider, ALLOWED_EMAILS, signInWithPopup, signOut, onAuthStateChanged };

export async function db_saveState(uid, stateObj) {
  try { await setDoc(uDoc(uid, 'meta', 'state'), stateObj, { merge: true }); }
  catch (e) { console.warn('[db] saveState fail', e); }
}

export async function db_loadState(uid) {
  try {
    const snap = await getDoc(uDoc(uid, 'meta', 'state'));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function db_saveEpisode(uid, ep) {
  try {
    const epId = ep.id || Date.now().toString();
    await setDoc(uDoc(uid, 'episodes', epId), { ...ep, id: epId }, { merge: true });
  } catch (e) { console.warn('[db] saveEpisode fail', e); }
}

export async function db_getEpisodes(uid) {
  try {
    const q    = query(uCol(uid, 'episodes'), orderBy('savedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch {
    try {
      const snap = await getDocs(uCol(uid, 'episodes'));
      return snap.docs.map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } catch { return []; }
  }
}

export async function db_getEpisode(uid, epId) {
  try {
    const snap = await getDoc(uDoc(uid, 'episodes', epId));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch { return null; }
}

export async function db_deleteEpisode(uid, epId) {
  try { await deleteDoc(uDoc(uid, 'episodes', epId)); }
  catch (e) { console.warn('[db] deleteEpisode fail', e); }
}

export async function db_getUsedIdeas(uid) {
  try {
    const snap = await getDoc(uDoc(uid, 'meta', 'usedIdeas'));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch { return []; }
}

export async function db_saveUsedIdeas(uid, list) {
  try { await setDoc(uDoc(uid, 'meta', 'usedIdeas'), { list }, { merge: true }); }
  catch (e) { console.warn('[db] saveUsedIdeas fail', e); }
}

export async function db_getSeasons(uid) {
  try {
    const snap = await getDocs(uCol(uid, 'seasons'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch { return []; }
}

export async function db_saveSeason(uid, seasonId, data) {
  try { await setDoc(uDoc(uid, 'seasons', seasonId), data, { merge: true }); }
  catch (e) { console.warn('[db] saveSeason fail', e); }
}
