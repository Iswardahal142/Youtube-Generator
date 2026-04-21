'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { key: 'generate',   icon: '✍️',  label: 'Generate',   path: '/generate'    },
  { key: 'my-stories', icon: '📚',  label: 'My Stories', path: '/my-stories'  },
  { key: 'youtube',    icon: '▶',   label: 'YouTube',    path: '/youtube',     iconStyle: { color: '#ff4444' } },
  { key: 'profile',    icon: '👤',  label: 'Profile',    path: '/profile'      },
];

export default function BottomNav({ userInitial }) {
  const pathname = usePathname();
  const router   = useRouter();

  function isActive(tab) {
    return pathname.startsWith(tab.path) ||
      (tab.key === 'generate' && (pathname === '/' || pathname.startsWith('/generate') || pathname.startsWith('/story') || pathname.startsWith('/thumb') || pathname.startsWith('/analysis')));
  }

  return (
    <nav style={{
      position:        'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex:          998,
      display:         'flex',
      alignItems:      'stretch',
      background:      'rgba(8,0,8,0.97)',
      backdropFilter:  'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderTop:       '1px solid #2a0022',
      height:          58,
      paddingBottom:   'env(safe-area-inset-bottom, 0px)',
    }}>
      {TABS.map(tab => {
        const active = isActive(tab);
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.path)}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            3,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              padding:        '6px 4px',
              WebkitTapHighlightColor: 'transparent',
              position:       'relative',
            }}
          >
            {/* Active indicator */}
            {active && (
              <span style={{
                position:     'absolute',
                top: 0, left: '20%', right: '20%',
                height:       2,
                background:   '#cc2244',
                borderRadius: '0 0 3px 3px',
              }} />
            )}
            <span style={{
              fontSize:   18,
              lineHeight: 1,
              transform:  active ? 'translateY(-1px)' : 'none',
              transition: 'transform 0.15s',
              ...(tab.iconStyle || {}),
            }}>
              {tab.key === 'profile' ? (userInitial || tab.icon) : tab.icon}
            </span>
            <span style={{
              fontSize:      10,
              color:         active ? '#cc2244' : '#555',
              letterSpacing: 0.3,
              fontFamily:    "'Noto Sans Devanagari', sans-serif",
              transition:    'color 0.15s',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
