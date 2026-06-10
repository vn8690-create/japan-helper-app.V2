import { useEffect, useState } from 'react';
import { ScanLine, CheckSquare, BookOpen, Phone, MessageCircle, ArrowRight, Lightbulb, AlertTriangle, Clock, CheckCircle2, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, ActionItem, ScannedDocument } from '../lib/supabase';
import { Page } from '../components/BottomNav';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

interface Stats {
  pending: number;
  overdue: number;
  completed: number;
  scanned: number;
}

const featureConfig = [
  { key: 'scan' as const, page: 'scan' as Page, icon: ScanLine, color: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  { key: 'checklist' as const, page: 'checklist' as Page, icon: CheckSquare, color: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'guide' as const, page: 'guide' as Page, icon: BookOpen, color: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400' },
  { key: 'emergency' as const, page: 'emergency' as Page, icon: Phone, color: 'bg-japan-600', light: 'bg-japan-50 dark:bg-japan-900/20', text: 'text-japan-700 dark:text-japan-400' },
  { key: 'practice' as const, page: 'practice' as Page, icon: MessageCircle, color: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400' },
];

function getTodayTip(tips: string[]): string {
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return tips[dayOfYear % tips.length];
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats>({ pending: 0, overdue: 0, completed: 0, scanned: 0 });
  const [recentActions, setRecentActions] = useState<ActionItem[]>([]);
  const [recentScans, setRecentScans] = useState<ScannedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [actionsRes, scansRes] = await Promise.all([
          supabase.from('action_items').select('*').order('created_at', { ascending: false }),
          supabase.from('scanned_documents').select('*').order('created_at', { ascending: false }).limit(3),
        ]);

        if (actionsRes.data) {
          const actions = actionsRes.data as ActionItem[];
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const pending = actions.filter(a => !a.completed).length;
          const overdue = actions.filter(a => !a.completed && a.due_date && new Date(a.due_date) < today).length;
          const completed = actions.filter(a => a.completed).length;

          setStats(s => ({ ...s, pending, overdue, completed }));
          setRecentActions(actions.filter(a => !a.completed).slice(0, 3));
        }

        if (scansRes.data) {
          setRecentScans(scansRes.data as ScannedDocument[]);
          setStats(s => ({ ...s, scanned: scansRes.data?.length ?? 0 }));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const tip = getTodayTip(t.dashboard.tips);
  const urgencyColors: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="page-container space-y-5 animate-fade-in">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-japan-700 via-japan-800 to-japan-950 p-5 text-white">
        <div className="relative z-10">
          <p className="text-xs font-medium text-japan-200 mb-1 uppercase tracking-widest">Japan Helper</p>
          <h2 className="text-xl font-bold leading-tight mb-1">{t.dashboard.welcome}</h2>
          <p className="text-sm text-japan-200 leading-relaxed">{t.dashboard.subtitle}</p>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 right-12 w-20 h-20 bg-white/5 rounded-full translate-y-8" />
        <div className="absolute top-1/2 right-4 w-12 h-12 bg-white/5 rounded-full" />
        {/* Japanese circle motif */}
        <div className="absolute top-3 right-3 w-10 h-10 border-2 border-white/20 rounded-full" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t.dashboard.stats.pending, value: stats.pending, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: t.dashboard.stats.overdue, value: stats.overdue, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: t.dashboard.stats.completed, value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: t.dashboard.stats.scanned, value: stats.scanned, icon: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-3 flex flex-col items-center gap-1 text-center">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={14} className={color} />
            </div>
            <span className="text-lg font-bold text-neutral-900 dark:text-white leading-none">{loading ? '–' : value}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Daily Tip */}
      <div className="card p-4 flex gap-3 items-start border-l-4 border-l-amber-400">
        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={15} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">{t.dashboard.tip}</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{tip}</p>
        </div>
      </div>

      {/* Quick Access Features */}
      <div>
        <p className="section-title">{t.dashboard.quickAccess}</p>
        <div className="grid grid-cols-2 gap-3">
          {featureConfig.map(({ key, page, icon: Icon, light, text }) => (
            <button
              key={key}
              onClick={() => onNavigate(page)}
              className="card p-4 flex items-start gap-3 text-left hover:shadow-md active:scale-[0.98] transition-all duration-150 group"
            >
              <div className={`w-10 h-10 rounded-xl ${light} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                <Icon size={18} className={text} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
                  {t.dashboard.features[key].title}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">
                  {t.dashboard.features[key].desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pending Actions */}
      {recentActions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t.dashboard.pendingActions}</p>
            <button onClick={() => onNavigate('checklist')} className="text-xs text-japan-700 dark:text-japan-400 font-medium flex items-center gap-1">
              {t.common.view} <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentActions.map(action => {
              const daysLeft = action.due_date ? getDaysUntil(action.due_date) : null;
              return (
                <div key={action.id} className="card p-3.5 flex items-start gap-3">
                  <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    action.urgency === 'critical' ? 'bg-red-500' :
                    action.urgency === 'high' ? 'bg-orange-500' :
                    action.urgency === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{action.title}</p>
                    {daysLeft !== null && (
                      <p className={`text-xs mt-0.5 ${daysLeft < 0 ? 'text-red-500' : daysLeft === 0 ? 'text-orange-500' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {daysLeft < 0
                          ? `${Math.abs(daysLeft)} ${t.common.daysOverdue}`
                          : daysLeft === 0
                          ? t.common.today
                          : `${daysLeft} ${t.common.daysLeft}`}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgencyColors[action.urgency]}`}>
                    {t.checklist.urgencies[action.urgency]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">{t.dashboard.recentScans}</p>
            <button onClick={() => onNavigate('scan')} className="text-xs text-japan-700 dark:text-japan-400 font-medium flex items-center gap-1">
              {t.common.view} <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentScans.map(doc => (
              <div key={doc.id} className="card p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{doc.title}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                    {doc.deadline && ` · Due: ${new Date(doc.deadline).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && recentActions.length === 0 && recentScans.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-4xl mb-3">🇯🇵</p>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Get started!</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Scan a document or add a task to begin.</p>
        </div>
      )}
    </div>
  );
}
