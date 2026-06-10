import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Trash2, Calendar, ChevronDown, AlertTriangle, Clock, Loader2, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, ActionItem, Urgency, Category } from '../lib/supabase';

type Filter = 'all' | 'pending' | 'completed';

const urgencyColors: Record<Urgency, string> = {
  low: 'badge-urgency-low',
  medium: 'badge-urgency-medium',
  high: 'badge-urgency-high',
  critical: 'badge-urgency-critical',
};

const urgencyDotColors: Record<Urgency, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const categoryColors: Record<Category, string> = {
  tax: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  insurance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  pension: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  cityHall: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  other: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
};

function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

interface NewTaskForm {
  title: string;
  description: string;
  due_date: string;
  urgency: Urgency;
  category: Category;
}

const defaultForm: NewTaskForm = { title: '', description: '', due_date: '', urgency: 'medium', category: 'other' };

export default function ActionChecklist() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewTaskForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from('action_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setItems(data as ActionItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleComplete = async (item: ActionItem) => {
    const updated = { ...item, completed: !item.completed };
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    await supabase.from('action_items').update({ completed: updated.completed }).eq('id', item.id);
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('action_items').delete().eq('id', id);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('action_items')
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        urgency: form.urgency,
        category: form.category,
      })
      .select()
      .single();

    if (err) {
      setError(t.common.error);
    } else if (data) {
      setItems(prev => [data as ActionItem, ...prev]);
      setForm(defaultForm);
      setShowForm(false);
    }
    setSaving(false);
  };

  const filteredItems = items.filter(item => {
    if (filter === 'pending') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  const pendingCount = items.filter(i => !i.completed).length;
  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div className="page-container space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t.checklist.title}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{t.checklist.subtitle}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3"
        >
          <Plus size={16} />
          {t.checklist.addItem}
        </button>
      </div>

      {/* Add Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="card w-full max-w-lg p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 dark:text-white">{t.checklist.newTask.title}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-neutral-400 hover:text-neutral-600">
                <X size={18} />
              </button>
            </div>

            <input
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-japan-500"
              placeholder={t.checklist.newTask.titlePlaceholder}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />

            <textarea
              className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-japan-500 resize-none"
              placeholder={t.checklist.newTask.descPlaceholder}
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">{t.checklist.dueDateLabel}</label>
                <input
                  type="date"
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-japan-500"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">{t.checklist.urgencyLabel}</label>
                <select
                  className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-japan-500"
                  value={form.urgency}
                  onChange={e => setForm(f => ({ ...f, urgency: e.target.value as Urgency }))}
                >
                  {(['low', 'medium', 'high', 'critical'] as Urgency[]).map(u => (
                    <option key={u} value={u}>{t.checklist.urgencies[u]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">{t.checklist.categoryLabel}</label>
              <div className="flex flex-wrap gap-2">
                {(['tax', 'insurance', 'pension', 'cityHall', 'other'] as Category[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setForm(f => ({ ...f, category: cat }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      form.category === cat
                        ? 'bg-japan-700 text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {t.checklist.categories[cat]}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">{t.checklist.newTask.cancel}</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {t.checklist.newTask.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
        {(['all', 'pending', 'completed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              filter === f
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
          >
            {f === 'all' ? t.checklist.filterAll : f === 'pending' ? `${t.checklist.filterPending} ${pendingCount > 0 ? `(${pendingCount})` : ''}` : t.checklist.filterCompleted}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="text-japan-600 animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{t.checklist.empty}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const daysLeft = item.due_date ? getDaysUntil(item.due_date) : null;
            const isOverdue = daysLeft !== null && daysLeft < 0 && !item.completed;
            const isDueToday = daysLeft === 0 && !item.completed;

            return (
              <div
                key={item.id}
                className={`card p-4 flex gap-3 transition-all ${item.completed ? 'opacity-60' : ''}`}
              >
                {/* Complete toggle */}
                <button
                  onClick={() => toggleComplete(item)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                    ${item.completed
                      ? 'border-emerald-500 bg-emerald-500'
                      : `border-current ${urgencyDotColors[item.urgency].replace('bg-', 'border-')} hover:bg-current/10`
                    }`}
                >
                  {item.completed && <Check size={10} className="text-white" strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className={`text-sm font-medium leading-snug ${item.completed ? 'line-through text-neutral-400 dark:text-neutral-600' : 'text-neutral-800 dark:text-neutral-200'}`}>
                      {item.title}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${urgencyColors[item.urgency]}`}>
                      {t.checklist.urgencies[item.urgency]}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">{item.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${categoryColors[item.category as Category]}`}>
                      {t.checklist.categories[item.category as Category]}
                    </span>

                    {item.due_date && (
                      <span className={`flex items-center gap-1 text-xs ${
                        isOverdue ? 'text-red-500 dark:text-red-400 font-semibold' :
                        isDueToday ? 'text-orange-500 dark:text-orange-400 font-semibold' :
                        'text-neutral-500 dark:text-neutral-400'
                      }`}>
                        {isOverdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                        {isOverdue
                          ? `${t.checklist.overdue}: ${new Date(item.due_date).toLocaleDateString()}`
                          : isDueToday
                          ? t.checklist.today
                          : new Date(item.due_date).toLocaleDateString()
                        }
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-1.5 text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
