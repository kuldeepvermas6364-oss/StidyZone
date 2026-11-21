import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Atom, GraduationCap, LayoutDashboard, Settings } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { t } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Left Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw]">
            <Sidebar
              showCloseButton
              onClose={() => setMobileDrawerOpen(false)}
              onNavigate={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <TopHeader onOpenMobileDrawer={() => setMobileDrawerOpen(true)} />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-20 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>

        <footer className="hidden lg:block border-t border-slate-200 bg-white px-8 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <span>{t('footer.copy')}</span>
            <span className="font-mono">EN · हिन्दी</span>
          </div>
        </footer>
      </div>

      {/* Mobile Compact Bottom Navigation Bar (56px, keeps sticky total <= 112px / <15% of 844px) */}
      <nav
        aria-label="Quick mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-slate-200 bg-white/95 px-2 backdrop-blur-xs lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`
          }
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          <span>{t('nav.dashboard')}</span>
        </NavLink>
        <NavLink
          to="/up-board-class-12"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`
          }
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <span>{t('nav.upBoard12').split(' ')[0]} 12</span>
        </NavLink>
        <NavLink
          to="/jee-main"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`
          }
        >
          <Atom className="h-4 w-4" aria-hidden="true" />
          <span>{t('nav.jeeMain')}</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400'
            }`
          }
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          <span>{t('nav.settings')}</span>
        </NavLink>
      </nav>
    </div>
  );
};
