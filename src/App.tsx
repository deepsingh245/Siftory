import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'

type IconName =
  | 'all'
  | 'inbox'
  | 'collection'
  | 'category'
  | 'recent'
  | 'research'
  | 'queue'
  | 'insights'
  | 'settings'
  | 'search'
  | 'sun'
  | 'moon'
  | 'mark'
  | 'arrow'
  | 'spark'

const iconContent: Record<IconName, ReactNode> = {
  all: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  inbox: <><path d="M4 4.5h16l1.5 10v5H2.5v-5L4 4.5Z" /><path d="M2.8 14.5h5l1.5 2h5.4l1.5-2h5" /></>,
  collection: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4V2.5h8V4M7.5 9h9M7.5 13h6" /></>,
  category: <><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3.5 8 8.5 5 8.5-5M12 13v8" /></>,
  recent: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  research: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5M8 11h5.5M10.75 8.25v5.5" /></>,
  queue: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r=".8" /><circle cx="4" cy="12" r=".8" /><circle cx="4" cy="18" r=".8" /></>,
  insights: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z" transform="translate(-1 -1) scale(1.08)" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  moon: <path d="M20.8 14.2A8.5 8.5 0 0 1 9.8 3.2 8.7 8.7 0 1 0 20.8 14.2Z" />,
  mark: <><path d="M4 6.5h16M4 12h11M4 17.5h7" /><circle cx="19" cy="17.5" r="2" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {iconContent[name]}
    </svg>
  )
}

type NavigationItem = {
  label: string
  icon: IconName
  available?: boolean
}

const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  { label: 'Library', items: [{ label: 'All saved', icon: 'all', available: true }, { label: 'Inbox', icon: 'inbox' }] },
  { label: 'Organize', items: [{ label: 'Collections', icon: 'collection' }, { label: 'Categories', icon: 'category' }] },
  { label: 'Discover', items: [{ label: 'Recently viewed', icon: 'recent' }, { label: 'Research', icon: 'research' }, { label: 'Processing queue', icon: 'queue' }, { label: 'Insights', icon: 'insights' }] },
]

function NavigationGroups({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label={mobile ? 'Primary navigation' : 'Main navigation'} className={mobile ? 'mobile-nav' : 'sidebar-nav'}>
      {navigationGroups.map((group) => (
        <div className={mobile ? 'mobile-nav-group' : 'nav-group'} key={group.label}>
          {!mobile && <p className="nav-group-label">{group.label}</p>}
          <ul>
            {group.items.map((item) => (
              <li key={item.label}>
                {item.available ? (
                  <a className="nav-link nav-link--active" href="#main" aria-current="page">
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <span className="nav-link nav-link--planned" aria-disabled="true">
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    <span className="planned-label">{mobile ? 'Soon' : 'Planned'}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const isDark = theme === 'dark'

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      isDark ? '#171B1A' : '#E8E9DF',
    )
  }, [isDark])

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar" aria-label="Siftory workspace">
        <a className="brand" href="#main" aria-label="Siftory home">
          <span className="brand-mark"><Icon name="mark" size={21} /></span>
          <span className="brand-name">siftory<span>.</span></span>
        </a>
        <p className="brand-tagline">Save less. Understand more.</p>

        <NavigationGroups />

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-mark"><Icon name="spark" size={16} /></span>
            <span><strong>A little more clarity.</strong><small>Your personal research desk.</small></span>
          </div>
          <button
            className="theme-button sidebar-theme-button"
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={17} />
            <span>{isDark ? 'Light appearance' : 'Dark appearance'}</span>
          </button>
          <span className="sidebar-version">SIFTORY · FOUNDATION</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-header">
          <a className="brand" href="#main" aria-label="Siftory home">
            <span className="brand-mark"><Icon name="mark" size={20} /></span>
            <span className="brand-name">siftory<span>.</span></span>
          </a>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </button>
        </header>

        <NavigationGroups mobile />

        <main className="workspace" id="main">
          <div className="workspace-topline">
            <p className="breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>All saved</strong></p>
            <div className="search-placeholder" role="group" aria-label="Search your library, planned for Phase 2">
              <Icon name="search" size={17} />
              <span>Search your library</span>
              <span className="search-phase">Phase 2</span>
            </div>
          </div>

          <section className="library-intro" aria-labelledby="page-title">
            <p className="eyebrow"><span className="eyebrow-rule" /> YOUR PERSONAL RESEARCH LIBRARY</p>
            <h1 id="page-title">A little more room<br className="desktop-break" /> to think.</h1>
            <p className="intro-copy">A considered home for the ideas, sources, and moments<br className="desktop-break" /> you want to find again.</p>
          </section>

          <section className="empty-library" aria-labelledby="empty-title">
            <div className="empty-art" aria-hidden="true">
              <div className="paper paper-back"><span /><span /><span /></div>
              <div className="paper paper-front"><span /><span /><span /><i><Icon name="spark" size={23} /></i></div>
              <span className="art-orbit art-orbit-one" />
              <span className="art-orbit art-orbit-two" />
            </div>
            <div className="empty-copy">
              <p className="empty-kicker">A SPACE, TAKING SHAPE</p>
              <h2 id="empty-title">Your library starts here.</h2>
              <p>Library and import tools are coming in the next phases. When they arrive, this is where the things worth keeping will come together.</p>
            </div>
            <span className="empty-index" aria-hidden="true">01</span>
          </section>

          <footer className="workspace-footer">
            <span>Made for the things you want to understand.</span>
            <span className="footer-status"><span className="status-dot" /> FOUNDATION PHASE</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
