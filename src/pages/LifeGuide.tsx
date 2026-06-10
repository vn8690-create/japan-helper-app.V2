import { useState } from 'react';
import { ChevronDown, ChevronUp, Search, BookOpen, DollarSign, HeartPulse, Clock, Building2, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type GuideCategory = 'tax' | 'insurance' | 'pension' | 'cityHall';

interface GuideSection {
  heading: string;
  content: string;
}

const categoryConfig: { key: GuideCategory; icon: typeof BookOpen; color: string; light: string; text: string }[] = [
  { key: 'tax', icon: DollarSign, color: 'bg-blue-600', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  { key: 'insurance', icon: HeartPulse, color: 'bg-rose-600', light: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400' },
  { key: 'pension', icon: Clock, color: 'bg-teal-600', light: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
  { key: 'cityHall', icon: Building2, color: 'bg-amber-600', light: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
];

export default function LifeGuide() {
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<GuideCategory | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCategoryData = (key: GuideCategory) => t.guide[key] as { title: string; sections: GuideSection[] };

  const getFilteredCategories = () => {
    if (!search.trim()) return categoryConfig;
    const q = search.toLowerCase();
    return categoryConfig.filter(cat => {
      const data = getCategoryData(cat.key);
      return (
        data.title.toLowerCase().includes(q) ||
        data.sections.some(s => s.heading.toLowerCase().includes(q) || s.content.toLowerCase().includes(q))
      );
    });
  };

  const filteredCategories = getFilteredCategories();

  return (
    <div className="page-container space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t.guide.title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{t.guide.subtitle}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-japan-500"
          placeholder={t.guide.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category Cards (overview) */}
      {!activeCategory && (
        <div className="grid grid-cols-2 gap-3">
          {filteredCategories.map(({ key, icon: Icon, light, text }) => {
            const data = getCategoryData(key);
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className="card p-4 text-left hover:shadow-md active:scale-[0.98] transition-all duration-150 group"
              >
                <div className={`w-11 h-11 rounded-xl ${light} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon size={20} className={text} />
                </div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">{data.title}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {data.sections.length} sections
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail View */}
      {activeCategory && (() => {
        const config = categoryConfig.find(c => c.key === activeCategory)!;
        const data = getCategoryData(activeCategory);
        const Icon = config.icon;

        const visibleSections = search.trim()
          ? data.sections.filter(s => s.heading.toLowerCase().includes(search.toLowerCase()) || s.content.toLowerCase().includes(search.toLowerCase()))
          : data.sections;

        return (
          <div className="space-y-4 animate-fade-in">
            {/* Back + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveCategory(null)}
                className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${config.light} flex items-center justify-center`}>
                  <Icon size={16} className={config.text} />
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">{data.title}</h3>
              </div>
            </div>

            {/* Accordion sections */}
            <div className="space-y-2">
              {visibleSections.map((section, index) => {
                const sectionKey = `${activeCategory}-${index}`;
                const isExpanded = expandedSections[sectionKey];

                return (
                  <div key={index} className="card overflow-hidden">
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.color}`} />
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-snug">
                          {section.heading}
                        </span>
                      </div>
                      {isExpanded
                        ? <ChevronUp size={16} className="text-neutral-400 flex-shrink-0 ml-2" />
                        : <ChevronDown size={16} className="text-neutral-400 flex-shrink-0 ml-2" />
                      }
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 animate-slide-up">
                        <div className="h-px bg-neutral-100 dark:bg-neutral-800 mb-3" />
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {section.content}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* All Categories quick nav */}
            <div>
              <p className="section-title">Other Topics</p>
              <div className="flex flex-wrap gap-2">
                {categoryConfig.filter(c => c.key !== activeCategory).map(({ key, icon: BtnIcon, text, light }) => {
                  const d = getCategoryData(key);
                  return (
                    <button
                      key={key}
                      onClick={() => { setActiveCategory(key); setExpandedSections({}); }}
                      className="flex items-center gap-2 px-3 py-2 card text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:shadow-md transition-all active:scale-95"
                    >
                      <div className={`w-5 h-5 rounded-md ${light} flex items-center justify-center`}>
                        <BtnIcon size={11} className={text} />
                      </div>
                      {d.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {filteredCategories.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No results for "{search}"</p>
          <button onClick={() => setSearch('')} className="mt-3 text-xs text-japan-700 dark:text-japan-400 font-medium">Clear search</button>
        </div>
      )}
    </div>
  );
}
