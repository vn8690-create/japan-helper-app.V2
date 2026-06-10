import { Sun, Moon, Globe, LogOut } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Language, languageLabels } from '../i18n';
import { useState, useRef, useEffect } from 'react';
import { Page } from './BottomNav';

interface HeaderProps {
  currentPage: Page;
}

const pageTitleKeys: Record<Page, string> = {
  dashboard: 'dashboard',
  scan: 'scan',
  checklist: 'checklist',
  guide: 'guide',
  emergency: 'emergency',
  practice: 'practice',
};

export default function Header({ currentPage }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const titleKey = pageTitleKeys[currentPage] as keyof typeof t.nav;
  const title = currentPage === 'dashboard' ? t.header.appName : t.nav[titleKey];

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
        {/* Logo / Title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-japan-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black tracking-tight">JH</span>
          </div>
          <h1 className="font-semibold text-base text-neutral-900 dark:text-white leading-tight">
            {title}
          </h1>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1">
          {/* Language Switcher */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 dark:text-neutral-300
                         hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs font-medium"
              aria-label="Switch language"
            >
              <Globe size={14} />
              <span>{languageLabels[language]}</span>
            </button>

            {langOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 card shadow-lg overflow-hidden animate-fade-in z-50">
                {(['en', 'ja', 'vi'] as Language[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => { setLanguage(lang); setLangOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors
                      ${lang === language
                        ? 'bg-japan-50 dark:bg-japan-900/20 text-japan-700 dark:text-japan-400 font-medium'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                  >
                    <span>{languageLabels[lang]}</span>
                    {lang === language && <span className="w-1.5 h-1.5 rounded-full bg-japan-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300
                       hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300
                       hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
