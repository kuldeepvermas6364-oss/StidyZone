import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Globe, Menu, Moon, Search, Sun, User, X } from 'lucide-react';
import { PLATFORM_MODULES } from '../../config/modules';
import { ALL_CURRICULUM_SUBJECTS } from '../../data/curriculum';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { translate } from '../../i18n/translations';
import { searchCurriculum } from '../../utils/curriculumSearch';
import { filterModulesByQuery, type SearchableModuleItem } from '../../utils/search';
import { PrepZoneLogo } from '../brand/PrepZoneLogo';
import { ModuleIcon } from '../common/ModuleIcon';

interface TopHeaderProps {
  onOpenMobileDrawer: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenMobileDrawer }) => {
  const {
    language,
    toggleLanguage,
    resolvedTheme,
    setTheme,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    t,
  } = useApp();
  const { isAuthenticated, session } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const notifBoxRef = useRef<HTMLDivElement>(null);

  const searchableItems: SearchableModuleItem[] = useMemo(
    () =>
      PLATFORM_MODULES.map((module) => ({
        module,
        labelEn: translate('en', module.titleKey),
        labelHi: translate('hi', module.titleKey),
        keywords: [
          translate('en', module.subtitleKey),
          translate('hi', module.subtitleKey),
          ...module.plannedCollections,
        ],
      })),
    []
  );

  const filteredModules = useMemo(
    () => filterModulesByQuery(searchableItems, query),
    [searchableItems, query]
  );

  const curriculumHits = useMemo(
    () => (query.trim().length > 0 ? searchCurriculum(ALL_CURRICULUM_SUBJECTS, query, 6) : []),
    [query]
  );

  const firstResultPath =
    filteredModules[0]?.module.path ?? curriculumHits[0]?.routePath ?? null;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktopSearch = searchBoxRef.current?.contains(target);
      const inMobileSearch = mobileSearchRef.current?.contains(target);
      if (!inDesktopSearch && !inMobileSearch) {
        setSearchOpen(false);
      }
      if (notifBoxRef.current && !notifBoxRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectModule = (path: string) => {
    setSearchOpen(false);
    setMobileSearchExpanded(false);
    setQuery('');
    navigate(path);
  };

  const renderSearchResults = () => (
    <div
      role="listbox"
      aria-label={t('header.searchLabel')}
      className="absolute left-0 right-0 top-12 z-40 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      {filteredModules.length === 0 && curriculumHits.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
          {t('header.searchNoResults')}
        </p>
      ) : (
        <div className="space-y-1">
          {filteredModules.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                {t('header.searchCategoryModules')}
              </p>
              {filteredModules.map((item) => (
                <button
                  key={item.module.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelectModule(item.module.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ModuleIcon
                    name={item.module.icon}
                    className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                      {language === 'hi' ? item.labelHi : item.labelEn}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.module.targetPrompt}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {curriculumHits.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                {t('header.searchCategorySyllabus')}
              </p>
              {curriculumHits.map((hit, idx) => (
                <button
                  key={`${hit.routePath}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelectModule(hit.routePath)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <BookOpen
                    className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                      {hit.kind === 'chapter' && hit.chapter
                        ? hit.chapter.title[language]
                        : hit.subject.name[language]}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {hit.subject.examTrack.toUpperCase()} · {hit.subject.name[language]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-14 lg:h-16 items-center justify-between gap-2 px-4 lg:px-6">
        {/* Left: Mobile Menu + Compact Logo + Desktop/Tablet Inline Search */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            aria-label={t('nav.openMenu')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link to="/" className="lg:hidden shrink-0" aria-label="PrepZone Home">
            <PrepZoneLogo compact />
          </Link>

          <div ref={searchBoxRef} className="relative hidden sm:block min-w-0 flex-1 max-w-md">
            <label htmlFor="prepzone-global-search" className="sr-only">
              {t('header.searchLabel')}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="prepzone-global-search"
              type="search"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && firstResultPath) {
                  e.preventDefault();
                  handleSelectModule(firstResultPath);
                } else if (e.key === 'Escape') {
                  setSearchOpen(false);
                }
              }}
              placeholder={t('header.searchPlaceholder')}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:bg-slate-900"
            />
            {searchOpen && renderSearchResults()}
          </div>
        </div>

        {/* Right: Mobile Search Trigger, Language Switcher, Theme Toggle, Notifications, Profile */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setMobileSearchExpanded((prev) => !prev);
              setSearchOpen(true);
            }}
            aria-expanded={mobileSearchExpanded}
            aria-label={t('header.searchLabel')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {mobileSearchExpanded ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={t('header.languageSwitch')}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="sm:hidden">{language === 'en' ? 'EN/हिं' : 'हिं/EN'}</span>
            <span className="hidden sm:inline">
              {language === 'en' ? 'English / हिं' : 'हिन्दी / EN'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={resolvedTheme === 'dark' ? t('header.themeDark') : t('header.themeLight')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Notifications */}
          <div ref={notifBoxRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-expanded={notifOpen}
              aria-label={`${t('header.notifications')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    {t('header.notifications')}
                  </h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {t('header.markAllRead')}
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          setNotifOpen(false);
                          if (n.actionPath) navigate(n.actionPath);
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 ${
                          !n.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {language === 'hi' ? n.titleHi : n.titleEn}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {language === 'hi' ? n.bodyHi : n.bodyEn}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* User Profile / Sign In */}
          <Link
            to={isAuthenticated ? '/profile' : '/login'}
            aria-label={isAuthenticated && session ? session.profile.fullName : t('nav.signIn')}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="hidden sm:inline max-w-[120px] truncate">
              {isAuthenticated && session ? session.profile.fullName : t('nav.signIn')}
            </span>
          </Link>
        </div>
      </div>

      {/* Expandable Mobile Search Bar Row */}
      {mobileSearchExpanded && (
        <div
          ref={mobileSearchRef}
          className="border-t border-slate-200 px-4 py-2.5 sm:hidden dark:border-slate-800"
        >
          <div className="relative">
            <label htmlFor="prepzone-mobile-search" className="sr-only">
              {t('header.searchLabel')}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="prepzone-mobile-search"
              type="search"
              autoFocus
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && firstResultPath) {
                  e.preventDefault();
                  handleSelectModule(firstResultPath);
                } else if (e.key === 'Escape') {
                  setMobileSearchExpanded(false);
                }
              }}
              placeholder={t('header.searchPlaceholder')}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {searchOpen && renderSearchResults()}
          </div>
        </div>
      )}
    </header>
  );
};
