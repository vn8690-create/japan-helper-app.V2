import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password);

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const titles = {
    login: { en: 'Sign In', ja: 'ログイン', vi: 'Đăng nhập' },
    signup: { en: 'Create Account', ja: 'アカウント作成', vi: 'Tạo tài khoản' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-neutral-900 dark:to-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 text-white text-2xl font-bold mb-4 shadow-lg">
            日
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Japan Helper
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            日本生活サポート
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex mb-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                Minimum 6 characters
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium transition-all shadow-lg shadow-red-600/25"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setIsLogin(false); setError(null); }}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setIsLogin(true); setError(null); }}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500 dark:text-neutral-500">
          Your data is private and secure
        </p>
      </div>
    </div>
  );
}
