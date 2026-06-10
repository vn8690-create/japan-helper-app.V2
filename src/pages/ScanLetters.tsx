import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, Loader2, Sparkles, Calendar, AlertTriangle,
  Plus, CheckCircle2, Trash2, ChevronDown, ChevronUp,
  WifiOff, Clock, ImageOff, ShieldAlert, KeyRound,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, ScannedDocument, Urgency, DocumentType, Category } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ScanStep = 'idle' | 'compressing' | 'extracting' | 'analyzing' | 'done' | 'error';

type ErrorCode =
  | 'API_KEY_MISSING'
  | 'INVALID_INPUT'
  | 'IMAGE_TOO_LARGE'
  | 'UNSUPPORTED_MIME'
  | 'GEMINI_ERROR'
  | 'GEMINI_BLOCKED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'NO_TEXT'
  | 'UNKNOWN';

interface ScanError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

interface GeminiActionItem {
  title: string;
  description: string;
  due_date: string | null;
  urgency: Urgency;
  category: DocumentType;
}

interface ScanResult {
  ocrText: string;
  title: string;
  summary: string;
  deadline: string | null;
  urgency: Urgency;
  documentType: DocumentType;
  actionItems: GeminiActionItem[];
}

// ---------------------------------------------------------------------------
// Error config — icon + hint per code
// ---------------------------------------------------------------------------
const ERROR_CONFIG: Record<ErrorCode, {
  icon: typeof WifiOff;
  title: string;
  retryable: boolean;
}> = {
  API_KEY_MISSING:  { icon: KeyRound,    title: 'API key not configured',       retryable: false },
  INVALID_INPUT:    { icon: ImageOff,    title: 'Invalid input',                retryable: false },
  IMAGE_TOO_LARGE:  { icon: ImageOff,    title: 'Image too large',              retryable: false },
  UNSUPPORTED_MIME: { icon: ImageOff,    title: 'Unsupported image format',     retryable: false },
  GEMINI_ERROR:     { icon: WifiOff,     title: 'AI service error',             retryable: true  },
  GEMINI_BLOCKED:   { icon: ShieldAlert, title: 'Blocked by safety filters',    retryable: false },
  TIMEOUT:          { icon: Clock,       title: 'Request timed out',            retryable: true  },
  PARSE_ERROR:      { icon: WifiOff,     title: 'Invalid AI response',          retryable: true  },
  NO_TEXT:          { icon: ImageOff,    title: 'No readable text found',       retryable: false },
  UNKNOWN:          { icon: AlertTriangle,'title': 'Unexpected error',          retryable: true  },
};

const urgencyColors: Record<Urgency, string> = {
  low:      'badge-urgency-low',
  medium:   'badge-urgency-medium',
  high:     'badge-urgency-high',
  critical: 'badge-urgency-critical',
};

const urgencyDotColors: Record<Urgency, string> = {
  low:      'bg-emerald-500',
  medium:   'bg-amber-500',
  high:     'bg-orange-500',
  critical: 'bg-red-500',
};

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------
function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',  webp: 'image/webp',
    gif: 'image/gif',  heic: 'image/heic', heif: 'image/heif',
  };
  return map[ext] ?? 'image/jpeg';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress large images to JPEG ≤ 1800 px / 85 % quality before sending.
 * Returns the same file unchanged if it is already small enough.
 */
async function prepareImage(
  file: File,
): Promise<{ base64: string; mimeType: string; compressed: boolean }> {
  const MAX_RAW_BYTES = 20 * 1024 * 1024; // 20 MB hard limit
  const COMPRESS_ABOVE = 2 * 1024 * 1024; // compress if > 2 MB
  const MAX_DIM = 1800;

  if (file.size > MAX_RAW_BYTES) {
    throw Object.assign(new Error('Image exceeds the 20 MB limit. Please use a smaller file.'), {
      code: 'IMAGE_TOO_LARGE' as ErrorCode,
    });
  }

  const mimeType = getMimeType(file);
  const needsCompression = file.size > COMPRESS_ABOVE || mimeType === 'image/heic' || mimeType === 'image/heif';

  if (!needsCompression) {
    return { base64: await fileToBase64(file), mimeType, compressed: false };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', compressed: true });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image for compression'));
    };

    img.src = objectUrl;
  });
}

// ---------------------------------------------------------------------------
// Parse error from edge function response
// ---------------------------------------------------------------------------
function parseScanError(code: string | undefined, message: string): ScanError {
  const knownCodes = Object.keys(ERROR_CONFIG) as ErrorCode[];
  const errorCode: ErrorCode = knownCodes.includes(code as ErrorCode)
    ? (code as ErrorCode)
    : 'UNKNOWN';
  return {
    code: errorCode,
    message,
    retryable: ERROR_CONFIG[errorCode].retryable,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ScanLetters() {
  const { t, language } = useLanguage();
  const [step, setStep]               = useState<ScanStep>('idle');
  const [result, setResult]           = useState<ScanResult | null>(null);
  const [scanError, setScanError]     = useState<ScanError | null>(null);
  const [savedId, setSavedId]         = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [history, setHistory]         = useState<ScannedDocument[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [expandedOcr, setExpandedOcr] = useState(false);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [createdActions, setCreatedActions] = useState(false);
  const [compressed, setCompressed]   = useState(false);
  const lastFile = useRef<File | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    const { data } = await supabase
      .from('scanned_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setHistory(data as ScannedDocument[]);
    setHistoryLoaded(true);
  }, [historyLoaded]);

  // -------------------------------------------------------------------------
  // Core analysis flow
  // -------------------------------------------------------------------------
  const processFile = useCallback(async (file: File) => {
    lastFile.current = file;
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setSavedId(null);
    setScanError(null);
    setSaveError(null);
    setCreatedActions(false);
    setExpandedOcr(false);

    // Step 1: compress / convert
    setStep('compressing');
    let imageBase64: string;
    let mimeType: string;
    let wasCompressed = false;

    try {
      const prep = await prepareImage(file);
      imageBase64   = prep.base64;
      mimeType      = prep.mimeType;
      wasCompressed = prep.compressed;
      setCompressed(wasCompressed);
    } catch (err) {
      const e = err as Error & { code?: ErrorCode };
      setScanError(parseScanError(e.code, e.message));
      setStep('error');
      return;
    }

    // Step 2: call edge function
    setStep('extracting');
    await new Promise(r => setTimeout(r, 300)); // brief pause so UI updates
    setStep('analyzing');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ imageBase64, mimeType, language }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setScanError(parseScanError(data.code, data.error ?? `Request failed (${res.status})`));
        setStep('error');
        return;
      }

      // Validate required fields exist before rendering
      if (typeof data.ocrText !== 'string' || typeof data.summary !== 'string') {
        setScanError(parseScanError('PARSE_ERROR', 'Incomplete response from AI service'));
        setStep('error');
        return;
      }

      setResult({
        ocrText:      data.ocrText,
        title:        data.title        ?? 'Document',
        summary:      data.summary      ?? '',
        deadline:     data.deadline     ?? null,
        urgency:      data.urgency      ?? 'medium',
        documentType: data.documentType ?? 'other',
        actionItems:  Array.isArray(data.actionItems) ? data.actionItems : [],
      });
      setStep('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      const isTimeout = message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort');
      setScanError(parseScanError(isTimeout ? 'TIMEOUT' : 'UNKNOWN', message));
      setStep('error');
    }
  }, [language]);

  const retry = () => {
    if (lastFile.current) processFile(lastFile.current);
  };

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    const { data, error } = await supabase
      .from('scanned_documents')
      .insert({
        title:         result.title,
        original_text: result.ocrText,
        ai_summary:    result.summary,
        deadline:      result.deadline,
        urgency:       result.urgency,
        document_type: result.documentType,
      })
      .select()
      .single();

    if (error) {
      setSaveError(t.common.error);
    } else if (data) {
      setSavedId(data.id);
      setHistoryLoaded(false);
    }
    setSaving(false);
  };

  const handleCreateActions = async () => {
    if (!result || result.actionItems.length === 0) return;
    await Promise.all(
      result.actionItems.map(item =>
        supabase.from('action_items').insert({
          title:       item.title,
          description: item.description || null,
          due_date:    item.due_date,
          urgency:     item.urgency,
          category:    item.category as Category,
          document_id: savedId ?? null,
        })
      )
    );
    setCreatedActions(true);
  };

  const handleDeleteHistory = async (id: string) => {
    await supabase.from('scanned_documents').delete().eq('id', id);
    setHistory(prev => prev.filter(d => d.id !== id));
  };

  const reset = () => {
    setStep('idle');
    setResult(null);
    setSavedId(null);
    setPreviewUrl(null);
    setExpandedOcr(false);
    setCreatedActions(false);
    setScanError(null);
    setSaveError(null);
    setCompressed(false);
    lastFile.current = null;
    if (fileRef.current) fileRef.current.value = '';
    loadHistory();
  };

  // -------------------------------------------------------------------------
  // Progress bar width per step
  // -------------------------------------------------------------------------
  const progressWidth: Record<ScanStep, string> = {
    idle:        'w-0',
    compressing: 'w-1/4',
    extracting:  'w-1/2',
    analyzing:   'w-4/5',
    done:        'w-full',
    error:       'w-full',
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="page-container space-y-5 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t.scan.title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.scan.subtitle}</p>
      </div>

      {/* ── Upload area ───────────────────────────────────────────────────── */}
      {step === 'idle' && (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          onDragOver={e => e.preventDefault()}
          className="card border-2 border-dashed border-neutral-300 dark:border-neutral-700
                     hover:border-japan-500 dark:hover:border-japan-500 transition-colors
                     cursor-pointer p-10 flex flex-col items-center gap-4 text-center group"
        >
          <div className="w-16 h-16 rounded-2xl bg-japan-50 dark:bg-japan-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload size={28} className="text-japan-600 dark:text-japan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t.scan.uploadArea}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t.scan.uploadHint}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        </div>
      )}

      {/* ── Processing ────────────────────────────────────────────────────── */}
      {(step === 'compressing' || step === 'extracting' || step === 'analyzing') && (
        <div className="card p-8 flex flex-col items-center gap-5 text-center">
          {previewUrl && (
            <img src={previewUrl} alt="preview" className="w-20 h-20 object-cover rounded-xl opacity-60" />
          )}
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} className="text-japan-600 animate-spin" />
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {step === 'compressing' ? 'Preparing image…' :
               step === 'extracting' ? t.scan.extracting : t.scan.analyzing}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.scan.processing}</p>
          </div>
          <div className="w-full max-w-xs bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5">
            <div className={`h-1.5 bg-japan-600 rounded-full transition-all duration-700 ${progressWidth[step]}`} />
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {step === 'error' && scanError && (() => {
        const cfg = ERROR_CONFIG[scanError.code];
        const Icon = cfg.icon;
        return (
          <div className="space-y-4 animate-fade-in">
            {previewUrl && (
              <div className="card overflow-hidden">
                <img src={previewUrl} alt="preview" className="w-full h-32 object-cover opacity-40" />
              </div>
            )}
            <div className="card p-6 flex flex-col items-center gap-4 text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                scanError.code === 'API_KEY_MISSING' ? 'bg-amber-50 dark:bg-amber-900/20' :
                scanError.code === 'TIMEOUT'         ? 'bg-blue-50 dark:bg-blue-900/20' :
                scanError.code === 'GEMINI_BLOCKED'  ? 'bg-orange-50 dark:bg-orange-900/20' :
                'bg-red-50 dark:bg-red-900/20'
              }`}>
                <Icon size={24} className={
                  scanError.code === 'API_KEY_MISSING' ? 'text-amber-600 dark:text-amber-400' :
                  scanError.code === 'TIMEOUT'         ? 'text-blue-600 dark:text-blue-400' :
                  scanError.code === 'GEMINI_BLOCKED'  ? 'text-orange-600 dark:text-orange-400' :
                  'text-red-500'
                } />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">{cfg.title}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-xs">{scanError.message}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={reset} className="btn-secondary flex-1 text-sm">{t.common.back}</button>
                {cfg.retryable && (
                  <button onClick={retry} className="btn-primary flex-1 text-sm">{t.common.tryAgain}</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="space-y-4 animate-slide-up">
          {/* Image preview */}
          {previewUrl && (
            <div className="card overflow-hidden relative">
              <img src={previewUrl} alt="scanned document" className="w-full h-36 object-cover" />
              {compressed && (
                <span className="absolute top-2 right-2 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded-full">
                  Compressed
                </span>
              )}
            </div>
          )}

          {/* Urgency + type badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${urgencyColors[result.urgency]}`}>
              {result.urgency.toUpperCase()}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {t.checklist.categories[result.documentType as Category] ?? result.documentType}
            </span>
          </div>

          {/* Document title */}
          <div className="card p-4">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-0.5">{t.scan.documentType}</p>
            <p className="text-base font-bold text-neutral-900 dark:text-white">{result.title}</p>
          </div>

          {/* OCR text (collapsible) */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setExpandedOcr(v => !v)}
              className="w-full flex items-center justify-between p-4"
            >
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t.scan.ocrResult}</span>
              {expandedOcr
                ? <ChevronUp size={16} className="text-neutral-400" />
                : <ChevronDown size={16} className="text-neutral-400" />}
            </button>
            {expandedOcr && (
              <div className="px-4 pb-4">
                <pre className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap font-mono leading-relaxed bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3">
                  {result.ocrText || '(No text extracted)'}
                </pre>
              </div>
            )}
          </div>

          {/* AI summary */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} className="text-japan-600 dark:text-japan-400" />
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t.scan.aiSummary}</span>
            </div>
            <ul className="space-y-2">
              {result.summary.split('\n').filter(Boolean).map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="text-japan-600 mt-0.5 flex-shrink-0">•</span>
                  <span className="leading-relaxed">{line.replace(/^[•·]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Deadline */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t.scan.detectedDeadline}</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-white">
                {result.deadline
                  ? new Date(result.deadline).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                  : t.scan.noDeadline}
              </p>
            </div>
          </div>

          {/* AI-generated action items preview */}
          {result.actionItems.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-3">
                Suggested Actions ({result.actionItems.length})
              </p>
              <ul className="space-y-3">
                {result.actionItems.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${urgencyDotColors[item.urgency]}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                      {item.due_date && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 font-medium">
                          Due: {new Date(item.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <AlertTriangle size={14} className="text-red-600" />
              <p className="text-sm text-red-700 dark:text-red-400">{saveError}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {!savedId ? (
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {saving ? t.common.loading : t.scan.saveDocument}
              </button>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{t.common.success}</p>
              </div>
            )}

            {result.actionItems.length > 0 && !createdActions && (
              <button onClick={handleCreateActions} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Plus size={16} />
                {t.scan.createAction} ({result.actionItems.length})
              </button>
            )}

            {createdActions && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  {result.actionItems.length} action{result.actionItems.length > 1 ? 's' : ''} added to checklist
                </p>
              </div>
            )}

            <button onClick={reset} className="btn-secondary w-full">{t.scan.scanAnother}</button>
          </div>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">{t.scan.recentDocuments}</p>
          {!historyLoaded && (
            <button onClick={loadHistory} className="text-xs text-japan-700 dark:text-japan-400 font-medium">Load</button>
          )}
        </div>

        {historyLoaded && history.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-6">{t.scan.emptyHistory}</p>
        )}

        <div className="space-y-2">
          {history.map(doc => (
            <div key={doc.id} className="card p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                <FileText size={15} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{doc.title}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {new Date(doc.created_at).toLocaleDateString()}
                  {doc.deadline && ` · Due ${new Date(doc.deadline).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleDeleteHistory(doc.id)}
                className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
