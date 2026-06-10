import { useState, useEffect, useCallback } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import BottomNav, { Page } from './components/BottomNav';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ScanLetters from './pages/ScanLetters';
import ActionChecklist from './pages/ActionChecklist';
import LifeGuide from './pages/LifeGuide';
import Emergency from './pages/Emergency';
import ConversationPractice from './pages/ConversationPractice';
import Login from './pages/Login';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from('action_items')
      .select('*', { count: 'exact', head: true })
      .eq('completed', false);
    setPendingCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (user) {
      fetchPendingCount();
    }
  }, [fetchPendingCount, user]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'checklist' || page === 'dashboard') {
      fetchPendingCount();
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'scan': return <ScanLetters />;
      case 'checklist': return <ActionChecklist />;
      case 'guide': return <LifeGuide />;
      case 'emergency': return <Emergency />;
      case 'practice': return <ConversationPractice />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-200">
      <Header currentPage={currentPage} />
      <main className="overflow-x-hidden">
        {renderPage()}
      </main>
      <BottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
        pendingCount={pendingCount}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
