import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  BookOpen, Clock3, FolderClosed, Grid2X2, Inbox, LayoutDashboard,
  ListTodo, Moon, Search, Settings, Shapes, Sun, Tag, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarRail, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar'
import { parseRoute, routeHref } from './app/routes'
import type { AppRoute } from './app/routes'
import { useLibraryData } from './features/library/useLibraryData'
import './App.css'
import './features/library/workspace.css'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard').then(({ Dashboard }) => ({ default: Dashboard })))
const LibraryWorkspace = lazy(() => import('./features/library/LibraryWorkspace').then(({ LibraryWorkspace }) => ({ default: LibraryWorkspace })))

const navigationGroups = [
  { label: 'Library', links: [
    { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
    { label: 'All saved', page: 'library', icon: Grid2X2 },
    { label: 'Inbox', page: 'inbox', icon: Inbox },
    { label: 'Import', page: 'import', icon: Upload },
  ] },
  { label: 'Organize', links: [
    { label: 'Collections', page: 'collections', icon: FolderClosed },
    { label: 'Categories', page: 'categories', icon: Shapes },
    { label: 'Tags', page: 'tags', icon: Tag },
  ] },
  { label: 'Discover', links: [
    { label: 'Recently viewed', page: 'recent', icon: Clock3 },
    { label: 'Research', page: 'research', icon: Search },
    { label: 'Processing queue', page: 'queue', icon: ListTodo },
  ] },
] as const

function sectionFor(route: AppRoute) {
  if (route.page === 'collection') return 'collections'
  if (route.page === 'category') return 'categories'
  if (route.page === 'tag') return 'tags'
  return route.page
}

function routeTitle(route: AppRoute) {
  const page = sectionFor(route)
  if (page === 'item') return 'Saved item'
  if (page === 'settings') return 'Settings'
  return navigationGroups.flatMap(({ links }) => [...links]).find((link) => link.page === page)?.label ?? 'Siftory'
}

function WorkspaceSidebar({ route }: { route: AppRoute }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const activePage = sectionFor(route)

  function closeOnNavigate() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="workspace-sidebar-header">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Siftory home">
              <a href="#/dashboard" onClick={closeOnNavigate} aria-label="Siftory home">
                <span className="workspace-brand-mark"><BookOpen aria-hidden="true" size={18} /></span>
                <span className="workspace-brand-copy"><strong>Siftory</strong><span>Research library</span></span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {isMobile && <Button type="button" variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setOpenMobile(false)}><X aria-hidden="true" /></Button>}
      </SidebarHeader>
      <SidebarContent>
        <nav id="workspace-navigation" aria-label="Workspace navigation">
          {navigationGroups.map(({ label, links }) => (
            <SidebarGroup key={label}>
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {links.map(({ label: title, page, icon: Icon }) => (
                    <SidebarMenuItem key={page}>
                      <SidebarMenuButton asChild tooltip={title} isActive={activePage === page} className="workspace-nav-link">
                        <a href={routeHref({ page })} aria-current={activePage === page ? 'page' : undefined} onClick={closeOnNavigate}>
                          <Icon aria-hidden="true" /><span>{title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" isActive={activePage === 'settings'} className="workspace-nav-link">
              <a href="#/settings" aria-current={activePage === 'settings' ? 'page' : undefined} onClick={closeOnNavigate}>
                <Settings aria-hidden="true" /><span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

type Appearance = 'dark' | 'light'

function SiteHeader({ searchInput, query, onQuery, appearance, onToggleTheme, showImport }: {
  searchInput: RefObject<HTMLInputElement | null>
  query: string
  onQuery: (value: string) => void
  appearance: Appearance
  onToggleTheme: () => void
  showImport: boolean
}) {
  const { isMobile, open, openMobile } = useSidebar()
  const trigger = useRef<HTMLButtonElement>(null)
  const wasMobileOpen = useRef(false)
  const appearanceLabel = appearance === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  useEffect(() => {
    const closed = wasMobileOpen.current && !openMobile
    wasMobileOpen.current = openMobile
    if (!closed) return
    let frame = 0
    const observer = new MutationObserver(restoreFocus)
    function restoreFocus() {
      if (document.querySelector('[data-slot="sidebar"][data-mobile="true"]')) return
      observer.disconnect()
      frame = requestAnimationFrame(() => {
        if (document.activeElement === document.body) trigger.current?.focus()
      })
    }
    observer.observe(document.body, { childList: true, subtree: true })
    restoreFocus()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [openMobile])

  return (
    <header className="workspace-header">
      <SidebarTrigger
        ref={trigger}
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={isMobile ? openMobile : open}
        aria-controls={isMobile && !openMobile ? undefined : 'workspace-navigation'}
        className="size-control"
      />
      <form className="workspace-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <Search size={16} aria-hidden="true" />
        <Input ref={searchInput} type="search" aria-label="Search your library" placeholder="Search your library" value={query} onChange={(event) => onQuery(event.target.value)} />
      </form>
      <div className="workspace-header-actions">
        {showImport && <Button asChild variant="outline" className="workspace-import-link">
          <a href="#/import"><Upload aria-hidden="true" />Import</a>
        </Button>}
        <Button type="button" variant="outline" size="icon" aria-label={appearanceLabel} title={appearanceLabel} onClick={onToggleTheme}>
          {appearance === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </div>
    </header>
  )
}

function App() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try { return localStorage.getItem('siftory-appearance') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  const [sidebarOpen] = useState(() => !document.cookie.split(';').some((cookie) => cookie.trim() === 'sidebar_state=false'))
  const [query, setQuery] = useState('')
  const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.hash))
  const library = useLibraryData()
  const previousRoute = useRef(route)
  const main = useRef<HTMLElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const title = routeTitle(route)

  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', appearance === 'dark')
    const canvas = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas)
    try { localStorage.setItem('siftory-appearance', appearance) } catch { /* The current theme still applies. */ }
  }, [appearance])

  useEffect(() => {
    document.title = `${title} · Siftory`
    if (previousRoute.current !== route && document.activeElement !== searchInput.current) {
      main.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    previousRoute.current = route
  }, [route, title])

  function searchLibrary(value: string) {
    setQuery(value)
    if (value.trim() && route.page !== 'library' && route.page !== 'inbox') window.location.hash = routeHref({ page: 'library' })
  }

  return (
    <SidebarProvider defaultOpen={sidebarOpen} className="app-shell" data-theme={appearance}>
      <a className="skip-link" href="#main" onClick={(event) => { event.preventDefault(); main.current?.focus() }}>Skip to content</a>
      <WorkspaceSidebar route={route} />
      <SidebarInset asChild className="workspace-inset">
        <div>
          <SiteHeader
            searchInput={searchInput}
            query={query}
            onQuery={searchLibrary}
            appearance={appearance}
            onToggleTheme={() => setAppearance((current) => current === 'dark' ? 'light' : 'dark')}
            showImport={route.page !== 'dashboard' && route.page !== 'import'}
          />
          <main id="main" ref={main} tabIndex={-1} className="workspace">
            {route.page === 'dashboard' ? (
              <Suspense fallback={<p role="status">Loading dashboard…</p>}><Dashboard data={library} /></Suspense>
            ) : (
              <>
                {route.page !== 'settings' && library.error && !library.loading && <div className="storage-error" role="alert"><span>{library.error}</span><Button variant="outline" type="button" onClick={() => void library.refresh()}>Retry</Button></div>}
                <Suspense fallback={<p role="status">Opening your library…</p>}><LibraryWorkspace route={route} data={library} query={query} /></Suspense>
              </>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
