import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LogIn, User, X } from 'lucide-react';
import { PLATFORM_MODULES } from '../../config/modules';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import type { ModuleCategory } from '../../types/platform';
import { PrepZoneLogo } from '../brand/PrepZoneLogo';
import { ModuleIcon } from '../common/ModuleIcon';

interface SidebarProps {
  onNavigate?: () => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}

const CATEGORY_ORDER: Array<{ key: ModuleCategory; labelKey: string }> = [
  { key: 'core', labelKey: 'nav.group.core' },
  { key: 'tracks', labelKey: 'nav.group.tracks' },
  { key: 'tools', labelKey: 'nav.group.tools' },
  { key: 'account', labelKey: 'nav.group.account' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  onNavigate,
  showCloseButton = false,
  onClose,
}) => {
  const { t } = useApp();
  const { isAuthenticated, session } = useAuth();

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
        <Link
          to="/"
          onClick={onNavigate}
          className="focus-visible:outline-2 focus-visible:outline-blue-600 rounded-md"
        >
          <PrepZoneLogo />
        </Link>
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
      >
        {CATEGORY_ORDER.map((group) => {
          const items = PLATFORM_MODULES.filter((m) => m.category === group.key).sort(
            (a, b) => a.navOrder - b.navOrder
          );
          return (
            <div key={group.key}>
              <p className="px-3 mb-2 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                {t(group.labelKey)}
              </p>
              <ul className="space-y-1">
                {items.map((mod) => (
                  <li key={mod.id}>
                    <NavLink
                      to={mod.path}
                      end={mod.path === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                        }`
                      }
                    >
                      <ModuleIcon name={mod.icon} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(mod.titleKey)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
        {isAuthenticated && session ? (
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              {session.profile.fullName.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900 dark:text-white">
                {session.profile.fullName}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {t('nav.profile')}
              </span>
            </span>
          </Link>
        ) : (
          <Link
            to="/login"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap dark:text-blue-400 dark:hover:bg-blue-950/50"
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('nav.signIn')}</span>
            <User className="ml-auto h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
};
