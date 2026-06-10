import { Home, ScanLine, CheckSquare, BookOpen, Phone, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export type Page = 'dashboard' | 'scan' | 'checklist' | 'guide' | 'emergency' | 'practice';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  pendingCount?: number;
}

const navItems: { id: Page; icon: typeof Home; labelKey: keyof ReturnType<typeof useLanguage>['t']['nav'] }[] = [
  { id: 'dashboard', icon: Home, labelKey: 'dashboard' },
  { id: 'scan', icon: ScanLine, labelKey: 'scan' },
  { id: 'checklist', icon: CheckSquare, labelKey: 'checklist' },
  { id: 'guide', icon: BookOpen, labelKey: 'guide' },
  { id: 'emergency', icon: Phone, labelKey: 'emergency' },
  { id: 'practice', icon: MessageCircle, labelKey: 'practice' },
];

export default function BottomNav({ currentPage, onNavigate, pendingCount = 0 }: BottomNavProps) {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800 safe-area-inset-bottom">
      <div className="max-w-2xl mx-auto flex items-stretch">
        {navItems.map(({ id, icon: Icon, labelKey }) => {
          const isActive = currentPage === id;
          const showBadge = id === 'checklist' && pendingCount > 0;

          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 relative transition-all duration-150 min-h-[56px]
                ${isActive
                  ? 'text-japan-700 dark:text-japan-400'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
            >
              <div className={`relative transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                <Icon
                  size={id === 'emergency' ? 22 : 20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={id === 'emergency' && !isActive ? 'text-neutral-400 dark:text-neutral-500' : ''}
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 bg-japan-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 leading-none">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {t.nav[labelKey]}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-japan-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
