'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { db_saveState, db_loadState } from './firebase';

// ── Default State ─────────────────────────────────
const DEFAULT_STATE = {
  apiKey:         '',
  channel:        '',
  season:         'SEASON 1',
  epNum:          'EP 01',
  title:          'पुरानी हवेली का राज',
  prompt:         '',
  storyChunks:    [],
  storyEnded:     false,
  thumbColor:     '#cc0000',
  thumbBg:        'graveyard',
  currentEpId:    null,
  seasonBible:    null,
  linkedSeasonId: null,
  savedScenes:    null,
  savedChars:     null,
  characterBible: null,
  savedNarration: null,
  ytTitle:        null,
  ytDesc:         null,
  savedScenesEpId:null,
};

// ── Context ───────────────────────────────────────
const AppStateContext = createContext(null);

export function AppStateProvider({ children, uid }) {
  const [state,    setState]   = useState(DEFAULT_STATE);
  const [loaded,   setLoaded]  = useState(false);

  // Load from Firestore
  const loadState = useCallback(async () => {
    if (!uid) return;
    const d = await db_loadState(uid);
    if (d) {
      const merged = { ...DEFAULT_STATE, ...d };
      if (merged.channel === 'KAALI RAAT') merged.channel = '';
      setState(merged);
    }
    setLoaded(true);
  }, [uid]);

  // Save to Firestore
  const saveState = useCallback((updates) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      if (uid) db_saveState(uid, next);
      return next;
    });
  }, [uid]);

  return (
    <AppStateContext.Provider value={{ state, saveState, loadState, loaded }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be inside AppStateProvider');
  return ctx;
}
