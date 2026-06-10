import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageCircle, RotateCcw, Lightbulb, ChevronRight, Mic, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, ConversationMessage } from '../lib/supabase';

type ScenarioKey = 'cityHall' | 'doctor' | 'bank' | 'school';

interface ScriptEntry {
  assistantJp: string;
  assistantEn: string;
  hint?: string;
  correction?: (input: string) => { text: string; tip: string } | null;
}

const SCRIPTS: Record<ScenarioKey, ScriptEntry[]> = {
  cityHall: [
    {
      assistantJp: 'はい、○○市役所でございます。本日はどのようなご用件でしょうか？',
      assistantEn: 'Hello, this is ○○ City Hall. How can I help you today?',
      hint: 'Try: "住民票をお願いしたいのですが" (I would like to request a certificate of residence)',
    },
    {
      assistantJp: 'かしこまりました。お名前と在留カード番号をお聞かせいただけますか？',
      assistantEn: 'Understood. Could I have your name and residence card number?',
      hint: 'Say your name and mention: "在留カード番号は〇〇〇〇です" (My residence card number is ...)',
      correction: (input) => {
        if (input.length < 5) return { text: 'Try to give more detail. Mention your name (お名前) and residence card number.', tip: '私の名前は[your name]です。在留カード番号は[number]です。' };
        return null;
      },
    },
    {
      assistantJp: 'ありがとうございます。何通ご必要でしょうか？',
      assistantEn: 'Thank you. How many copies do you need?',
      hint: 'Say: "一通お願いします" (One copy please) or "二通お願いします" (Two copies please)',
    },
    {
      assistantJp: '承知しました。手数料は一通300円でございます。窓口でのお受け取りとなります。',
      assistantEn: 'Understood. The fee is ¥300 per copy. Please collect it at the counter.',
      hint: 'Reply: "わかりました。ありがとうございます。" (I understand. Thank you.)',
    },
    {
      assistantJp: 'こちらこそありがとうございます。ご来庁の際はご本人確認書類をご持参ください。',
      assistantEn: 'Thank you! Please bring your ID when you come in.',
      hint: 'End with: "はい、わかりました。失礼します。" (Yes, understood. Goodbye.)',
    },
  ],
  doctor: [
    {
      assistantJp: 'お電話ありがとうございます。○○クリニックでございます。',
      assistantEn: 'Thank you for calling. This is ○○ Clinic.',
      hint: 'Say: "予約をしたいのですが" (I would like to make an appointment)',
    },
    {
      assistantJp: '初診でしょうか、それとも再診でしょうか？',
      assistantEn: 'Is this your first visit, or a return visit?',
      hint: 'Say: "初診です" (First visit) or "再診です" (Return visit)',
    },
    {
      assistantJp: 'どのような症状でいらっしゃいますか？',
      assistantEn: 'What are your symptoms?',
      hint: 'Try: "熱があります" (I have a fever) or "お腹が痛いです" (I have stomach pain)',
      correction: (input) => {
        if (!input.includes('です') && !input.includes('ます')) {
          return { text: 'Remember to use polite form (-です/-ます) at the end of sentences.', tip: 'Example: "頭が痛いです" (My head hurts)' };
        }
        return null;
      },
    },
    {
      assistantJp: 'ご希望の日時はございますか？',
      assistantEn: 'Do you have a preferred date and time?',
      hint: 'Say: "〇月〇日の午前中はいかがでしょうか？" (How about the morning of [date]?)',
    },
    {
      assistantJp: 'では、○月○日の午前10時にご予約いたします。保険証をご持参ください。',
      assistantEn: 'Then I will book you for [date] at 10:00 AM. Please bring your insurance card.',
      hint: 'Confirm: "ありがとうございます。よろしくお願いします。" (Thank you. I look forward to it.)',
    },
  ],
  bank: [
    {
      assistantJp: 'いらっしゃいませ。○○銀行でございます。本日はどのようなご用件でしょうか？',
      assistantEn: 'Welcome. This is ○○ Bank. How may I help you today?',
      hint: 'Say: "口座を開設したいのですが" (I would like to open an account)',
    },
    {
      assistantJp: '外国籍のお客様でいらっしゃいますか？',
      assistantEn: 'Are you a foreign national?',
      hint: 'Say: "はい、外国籍です。在留カードを持っています。" (Yes, I am. I have a residence card.)',
    },
    {
      assistantJp: 'ご用意いただくものは、在留カード、パスポート、マイナンバーカードでございます。',
      assistantEn: 'You will need your residence card, passport, and My Number card.',
      hint: 'Confirm: "わかりました。全部持っています。" (Understood. I have all of them.)',
    },
    {
      assistantJp: 'それでは窓口にお越しください。整理番号をお取りいただき、お呼びするまでお待ちください。',
      assistantEn: 'Please come to our branch. Take a number and wait until you are called.',
      hint: 'Say: "何時まで受け付けていますか？" (Until what time do you accept customers?)',
    },
    {
      assistantJp: '平日の午前9時から午後3時まで受け付けております。',
      assistantEn: 'We accept customers from 9:00 AM to 3:00 PM on weekdays.',
      hint: 'Thank them: "ありがとうございます。うかがいます。" (Thank you. I will come by.)',
    },
  ],
  school: [
    {
      assistantJp: 'はい、○○小学校でございます。',
      assistantEn: 'Hello, this is ○○ Elementary School.',
      hint: 'Say: "入学手続きについてお聞きしたいのですが" (I would like to ask about enrollment procedures)',
    },
    {
      assistantJp: 'お子様は何年生になる予定でしょうか？',
      assistantEn: 'What grade will your child be in?',
      hint: 'Say: "来年4月に一年生になります" (They will be starting first grade in April next year)',
    },
    {
      assistantJp: '必要書類は、住民票、健康診断書、そして学校指定の入学届です。',
      assistantEn: 'Required documents are: certificate of residence, health record, and the school enrollment form.',
      hint: 'Ask: "書類はいつまでに提出すれば良いですか？" (By when should I submit the documents?)',
      correction: (input) => {
        if (input.toLowerCase().includes('when') || input.toLowerCase().includes('deadline')) {
          return { text: 'Great attempt! In Japanese, ask: "提出期限はいつですか？" (What is the submission deadline?)', tip: '提出 (ていしゅつ) = submission, 期限 (きげん) = deadline' };
        }
        return null;
      },
    },
    {
      assistantJp: '12月末までに市役所からの就学通知書と一緒にご提出ください。',
      assistantEn: 'Please submit them by end of December together with the school enrollment notice from city hall.',
      hint: 'Confirm: "はい、わかりました。ありがとうございます。" (Yes, understood. Thank you.)',
    },
    {
      assistantJp: 'ご不明な点がございましたら、いつでもお電話ください。',
      assistantEn: 'If you have any questions, please call us anytime.',
      hint: 'End: "お世話になります。失礼します。" (Thank you for your help. Goodbye.)',
    },
  ],
};

export default function ConversationPractice() {
  const { t } = useLanguage();
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSession = useCallback(async (key: ScenarioKey) => {
    setScenario(key);
    setScriptIndex(0);
    setMessages([]);
    setInput('');

    const script = SCRIPTS[key][0];
    const firstMsg: ConversationMessage = {
      role: 'assistant',
      content: script.assistantJp,
      translation: script.assistantEn,
      tip: script.hint,
      timestamp: new Date().toISOString(),
    };

    setIsTyping(true);
    await new Promise(r => setTimeout(r, 800));
    setIsTyping(false);
    setMessages([firstMsg]);

    const { data } = await supabase
      .from('conversation_sessions')
      .insert({ scenario: key, messages: [firstMsg] })
      .select()
      .single();
    if (data) setSessionId(data.id);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !scenario || isTyping) return;
    const userText = input.trim();
    setInput('');

    const script = SCRIPTS[scenario];
    const currentScript = script[scriptIndex];
    const correction = currentScript.correction?.(userText);

    const userMsg: ConversationMessage = {
      role: 'user',
      content: userText,
      correction: correction?.text,
      tip: correction?.tip,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    const nextIndex = scriptIndex + 1;
    if (nextIndex < script.length) {
      setIsTyping(true);
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));

      const nextScript = script[nextIndex];
      const assistantMsg: ConversationMessage = {
        role: 'assistant',
        content: nextScript.assistantJp,
        translation: nextScript.assistantEn,
        tip: nextScript.hint,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      setScriptIndex(nextIndex);
      setIsTyping(false);

      if (sessionId) {
        await supabase
          .from('conversation_sessions')
          .update({ messages: finalMessages })
          .eq('id', sessionId);
      }
    } else {
      const doneMsg: ConversationMessage = {
        role: 'assistant',
        content: 'お疲れ様でした！会話練習が完了しました。',
        translation: 'Well done! Conversation practice complete.',
        tip: 'Great job completing this scenario! Try another one to keep practicing.',
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, doneMsg]);
      setIsTyping(false);
    }
  }, [input, scenario, scriptIndex, messages, sessionId, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetSession = () => {
    setScenario(null);
    setMessages([]);
    setScriptIndex(0);
    setInput('');
    setSessionId(null);
  };

  const scenarioKeys: ScenarioKey[] = ['cityHall', 'doctor', 'bank', 'school'];

  if (!scenario) {
    return (
      <div className="page-container space-y-5 animate-fade-in">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t.practice.title}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{t.practice.subtitle}</p>
        </div>

        <p className="section-title">{t.practice.selectScenario}</p>

        <div className="space-y-3">
          {scenarioKeys.map(key => {
            const scenario = t.practice.scenarios[key];
            return (
              <button
                key={key}
                onClick={() => startSession(key)}
                className="card w-full p-4 flex items-center gap-4 text-left hover:shadow-md active:scale-[0.98] transition-all duration-150 group"
              >
                <div className="text-3xl w-12 h-12 flex items-center justify-center rounded-2xl bg-neutral-50 dark:bg-neutral-800 group-hover:scale-110 transition-transform">
                  {scenario.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">{scenario.title}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{scenario.desc}</p>
                </div>
                <ChevronRight size={16} className="text-neutral-400 group-hover:text-japan-600 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Info Card */}
        <div className="card p-4 flex gap-3 items-start border-l-4 border-l-japan-500">
          <Lightbulb size={15} className="text-japan-600 dark:text-japan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-japan-700 dark:text-japan-400 mb-1">How it works</p>
            <ul className="space-y-1">
              {['Choose a real-life scenario (city hall, doctor, etc.)', 'The AI plays the role of Japanese staff', 'Type your response to practice Japanese', 'Get corrections and helpful tips after each turn'].map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="text-japan-500 font-bold">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const currentTip = t.practice.tips[scenario as keyof typeof t.practice.tips];
  const progress = scriptIndex / SCRIPTS[scenario].length;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto animate-fade-in">
      {/* Chat Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-2xl">{t.practice.scenarios[scenario].icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t.practice.scenarios[scenario].title}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-japan-600 rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400">{scriptIndex}/{SCRIPTS[scenario].length}</span>
          </div>
        </div>
        <button onClick={resetSession} className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Tip bar */}
      {currentTip && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30">
          <p className="text-xs text-amber-700 dark:text-amber-400">{currentTip}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
              ${msg.role === 'user'
                ? 'bg-japan-100 dark:bg-japan-900/30 text-japan-700 dark:text-japan-400'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              }`}
            >
              {msg.role === 'user' ? t.practice.youLabel.charAt(0) : 'JP'}
            </div>

            <div className={`max-w-[75%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              {/* Role label */}
              <p className={`text-[10px] font-medium ${msg.role === 'user' ? 'text-right text-japan-600 dark:text-japan-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {msg.role === 'user' ? t.practice.youLabel : t.practice.staffLabel}
              </p>

              {/* Main bubble */}
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-japan-700 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>

              {/* Translation */}
              {msg.translation && (
                <div className="flex gap-2 items-start max-w-full">
                  <Lightbulb size={12} className="text-neutral-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 italic leading-relaxed">{msg.translation}</p>
                </div>
              )}

              {/* Tip */}
              {msg.tip && msg.role === 'assistant' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-semibold">{t.practice.tip}: </span>{msg.tip}
                  </p>
                </div>
              )}

              {/* Correction */}
              {msg.correction && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={11} className="text-orange-600 dark:text-orange-400" />
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">{t.practice.correction}</p>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-300">{msg.correction}</p>
                  {msg.tip && <p className="text-xs text-orange-600 dark:text-orange-400 font-mono">{msg.tip}</p>}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2 items-center animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400">
              JP
            </div>
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(n => (
                  <div key={n} className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: `${n * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.practice.inputPlaceholder}
              disabled={isTyping}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-japan-500 pr-12 disabled:opacity-50"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-2xl bg-japan-700 hover:bg-japan-800 active:bg-japan-900 disabled:bg-neutral-200 dark:disabled:bg-neutral-800
                       flex items-center justify-center transition-all active:scale-95 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={16} className={`${!input.trim() || isTyping ? 'text-neutral-400' : 'text-white'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
