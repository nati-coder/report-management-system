import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';

/**
 * App shell: the header stays at the top and the sidebar at the left; only the centre division scrolls — down
 * and sideways (wide tables) — so neither one moves. When printing, the shell opens up so the whole page prints.
 */
export default function AppLayout() {
  const main = useRef(null);
  const { pathname } = useLocation();
  // The centre scrolls on its own, so a new page must start at the top (the window no longer scrolls).
  useEffect(() => { main.current?.scrollTo({ top: 0, left: 0 }); }, [pathname]);

  return (
    <div className="flex h-screen flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
      <Navbar />
      <div className="flex min-h-0 flex-1 print:block print:overflow-visible">
        <Sidebar />
        <main ref={main} className="min-w-0 flex-1 overflow-auto p-6 print:overflow-visible print:p-0"><Outlet /></main>
      </div>
    </div>
  );
}
