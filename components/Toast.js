'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [msg,     setMsg]     = useState('');
  const [visible, setVisible] = useState(false);

  const toast = useCallback((text) => {
    setMsg(text);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, [visible, msg]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position:   'fixed',
        bottom:     80,
        left:       '50%',
        transform:  `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
        background: '#161616',
        border:     '1px solid #250000',
        color:      '#ede0c8',
        padding:    '10px 20px',
        borderRadius: 50,
        fontSize:   13,
        zIndex:     999,
        opacity:    visible ? 1 : 0,
        transition: 'all 0.3s',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {msg}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
