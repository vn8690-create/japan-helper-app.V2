import { useState } from 'react';
import { Phone, ChevronDown, ChevronUp, Shield, AlertOctagon, Info, BookOpen } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Phrase {
  jp: string;
  reading: string;
  en: string;
}

interface UsefulNumber {
  number: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
}

export default function Emergency() {
  const { t } = useLanguage();
  const [showPhonetic, setShowPhonetic] = useState(true);
  const [expandedPhrase, setExpandedPhrase] = useState<number | null>(null);

  const mainEmergency = [
    {
      number: '110',
      label: t.emergency.police,
      desc: t.emergency.policeDesc,
      icon: Shield,
      bg: 'bg-blue-600',
      ring: 'ring-blue-600/20',
    },
    {
      number: '119',
      label: t.emergency.fireAndAmbulance,
      desc: t.emergency.fireAmbulanceDesc,
      icon: AlertOctagon,
      bg: 'bg-japan-700',
      ring: 'ring-japan-700/20',
    },
  ];

  const usefulNumbers: UsefulNumber[] = [
    {
      number: '#8000',
      label: t.emergency.childrenMedical,
      desc: '夜間・休日の子どもの医療相談',
      color: 'text-purple-700 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      number: '#7119',
      label: t.emergency.medicalConsultation,
      desc: '救急受診案内・健康相談',
      color: 'text-teal-700 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
    },
    {
      number: '0570-783-806',
      label: t.emergency.foreignersConsultation,
      desc: '外国人生活・在留相談ナビ',
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      number: '050-3816-2787',
      label: t.emergency.consularServices,
      desc: 'Japan Tourism Agency Hotline',
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
  ];

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t.emergency.title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{t.emergency.subtitle}</p>
      </div>

      {/* Main Emergency Buttons */}
      <div className="space-y-3">
        {mainEmergency.map(({ number, label, desc, icon: Icon, bg, ring }) => (
          <a
            key={number}
            href={`tel:${number}`}
            className={`flex items-center gap-4 p-5 rounded-2xl ${bg} ring-4 ${ring} text-white active:opacity-90 active:scale-[0.98] transition-all shadow-lg`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black leading-none">{number}</span>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold leading-tight">{label}</p>
              <p className="text-sm text-white/80 mt-0.5">{desc}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Phone size={18} className="text-white" />
            </div>
          </a>
        ))}
      </div>

      {/* Useful Numbers */}
      <div>
        <p className="section-title">{t.emergency.usefulNumbers}</p>
        <div className="space-y-2">
          {usefulNumbers.map(({ number, label, desc, color, bg }) => (
            <a
              key={number}
              href={`tel:${number.replace(/[^0-9+#]/g, '')}`}
              className="card p-4 flex items-center gap-4 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Phone size={16} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{label}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{desc}</p>
              </div>
              <span className={`text-sm font-bold ${color} font-mono`}>{number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Emergency Phrases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">{t.emergency.emergencyPhrases}</p>
          <button
            onClick={() => setShowPhonetic(v => !v)}
            className="text-xs text-japan-700 dark:text-japan-400 font-medium flex items-center gap-1"
          >
            <BookOpen size={12} />
            {showPhonetic ? t.emergency.hidePhonetic : t.emergency.showPhonetic}
          </button>
        </div>

        <div className="space-y-2">
          {(t.emergency.phrases as Phrase[]).map((phrase, i) => (
            <button
              key={i}
              onClick={() => setExpandedPhrase(expandedPhrase === i ? null : i)}
              className="card w-full p-4 text-left flex items-start gap-3 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="w-7 h-7 rounded-lg bg-japan-50 dark:bg-japan-900/20 flex items-center justify-center flex-shrink-0 font-bold text-japan-700 dark:text-japan-400 text-xs">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-neutral-900 dark:text-white">{phrase.jp}</p>
                {showPhonetic && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 italic">{phrase.reading}</p>
                )}
                {expandedPhrase === i && (
                  <p className="text-sm text-japan-700 dark:text-japan-400 mt-1.5 font-medium animate-fade-in">{phrase.en}</p>
                )}
              </div>
              {expandedPhrase === i
                ? <ChevronUp size={14} className="text-neutral-400 flex-shrink-0 mt-1" />
                : <ChevronDown size={14} className="text-neutral-400 flex-shrink-0 mt-1" />
              }
            </button>
          ))}
        </div>
      </div>

      {/* Disaster Info */}
      <div className="card p-4 flex gap-3 items-start border-l-4 border-l-orange-400">
        <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
          <Info size={15} className="text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-0.5">{t.emergency.disasterInfo}</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{t.emergency.disasterDesc}</p>
        </div>
      </div>
    </div>
  );
}
