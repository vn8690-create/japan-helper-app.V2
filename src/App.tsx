import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import BottomNav, { Page } from './components/BottomNav';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ScanLetters from './pages/ScanLetters';
import ActionChecklist from './pages/ActionChecklist';
import LifeGuide from './pages/LifeGuide';
import Emergency from './pages/Emergency';
import ConversationPractice from './pages/ConversationPractice';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { loading: profileLoading, isAdmin } = useProfile();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  const isCurrentPage = (page: Page) => currentPage === page;

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

  useEffect(() => {
    // Update currentPage based on route
    const path = location.pathname;
    if (path === '/admin') return;
    const pageMap: Record<string, Page> = {
      '/': 'dashboard',
      '/scan': 'scan',
      '/checklist': 'checklist',
      '/guide': 'guide',
      '/emergency': 'emergency',
      '/practice': 'practice',
    };
    setCurrentPage(pageMap[path] || 'dashboard');
  }, [location.pathname]);

  const handleNavigate = (page: Page) => {
    const routeMap: Record<Page, string> = {
      dashboard: '/',
      scan: '/scan',
      checklist: '/checklist',
      guide: '/guide',
      emergency: '/emergency',
      practice: '/practice',
    };
    navigate(routeMap[page]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'checklist' || page === 'dashboard') {
      fetchPendingCount();
    }
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Not logged in - show login
  if (!user) {
    return <Login />;
  }

  // Still loading profile
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Determine if we should show the bottom nav (not on admin page)
  const showNav = location.pathname !== '/admin';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-200">
      {location.pathname !== '/admin' && (
        <>
          <Header currentPage={currentPage} />
          <main className="overflow-x-hidden">
            <Routes>
              <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
              <Route path="/scan" element={<ScanLetters />} />
              <Route path="/checklist" element={<ActionChecklist />} />
              <Route path="/guide" element={<LifeGuide />} />
              <Route path="/emergency" element={<Emergency />} />
              <Route path="/practice" element={<ConversationPractice />} />
            </Routes>
          </main>
          <BottomNav
            currentPage={currentPage}
            onNavigate={handleNavigate}
            pendingCount={pendingCount}
          />
        </>
      )}
      {location.pathname === '/admin' && isAdmin && (
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ProfileProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
