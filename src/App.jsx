import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import SeasonSetup from './pages/SeasonSetup';
import RunTracker from './pages/RunTracker';
import Decay from './pages/Decay';
import DecayLog from './pages/DecayLog';
import ProtectedRoute from '@/components/ProtectedRoute';
import Overlay from './pages/Overlay';
import OverlayDeck from './pages/OverlayDeck';
import OverlayDeckIntro from './pages/OverlayDeckIntro';
import OverlayDecay from './pages/OverlayDecay';
import OverlayDeath from './pages/OverlayDeath';
import OverlayFrame from './pages/OverlayFrame';
import OverlayLayout from './pages/OverlayLayout';
import OverlayOutro from './pages/OverlayOutro';
import LiveTest from './pages/LiveTest';
import LiveTest from './pages/LiveTest';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

const AuthenticatedApp = () => {
    const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const isAuthPage = AUTH_PAGES.includes(location.pathname);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors (never on the login pages themselves, or it loops)
  if (authError && !isAuthPage) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/overlay" element={<Overlay />} />
      <Route path="/overlay/deck" element={<OverlayDeck />} />
      <Route path="/overlay/deck-intro" element={<OverlayDeckIntro />} />
      <Route path="/overlay/decay" element={<OverlayDecay />} />
      <Route path="/overlay/death" element={<OverlayDeath />} />
      <Route path="/overlay/frame" element={<OverlayFrame />} />
      <Route path="/overlay/layout" element={<OverlayLayout />} />
      <Route path="/overlay/live-test" element={<LiveTest />} />      
      <Route path="/overlay/outro" element={<OverlayOutro />} />
      <Route path="/overlay/live-test" element={<LiveTest />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<SeasonSetup />} />
        <Route path="/run-tracker" element={<RunTracker />} />
        <Route path="/decay" element={<Decay />} />
        <Route path="/decay-log" element={<DecayLog />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App