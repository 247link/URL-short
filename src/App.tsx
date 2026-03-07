import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./components/auth/AuthPage";
import Redirect from "./pages/Redirect";
import PasswordPage from "./pages/PasswordPage";
import ResetPassword from "./pages/ResetPassword";
import Statistics from "./pages/Statistics";
import GlobalStatistics from "./pages/GlobalStatistics";
import Archives from "./pages/Archives";

const queryClient = new QueryClient();

// ShortLink favicon SVG (chain link icon)
const SHORTLINK_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%233B82F6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/%3E%3C/svg%3E";

// Set default ShortLink favicon
const setDefaultFavicon = () => {
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  existingLinks.forEach(link => link.remove());

  // Create new favicon link
  const faviconLink = document.createElement('link');
  faviconLink.rel = 'icon';
  faviconLink.type = 'image/svg+xml';
  faviconLink.href = SHORTLINK_FAVICON;
  document.head.appendChild(faviconLink);

  // Also set as shortcut icon
  const shortcutLink = document.createElement('link');
  shortcutLink.rel = 'shortcut icon';
  shortcutLink.href = SHORTLINK_FAVICON;
  document.head.appendChild(shortcutLink);
};

// Component to handle favicon management
const FaviconManager = () => {
  const location = useLocation();

  // Set default ShortLink favicon on all pages except redirect pages
  useEffect(() => {
    // Only set default favicon if not on a redirect route or password page
    // Redirect and password pages will handle their own favicon changes
    const isRedirectRoute = location.pathname.startsWith('/s/') || 
      location.pathname.startsWith('/password/') ||
      location.pathname.startsWith('/reset-password') ||
      (location.pathname.split('/').filter(Boolean).length === 1 && 
       !['auth', 'statistics', 'archives'].includes(location.pathname.split('/').filter(Boolean)[0] || ''));
    
    if (!isRedirectRoute) {
      setDefaultFavicon();
    }
  }, [location.pathname]);

  return null;
};

// Component to intercept recovery links BEFORE routes render
const RecoveryLinkInterceptor = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Check URL hash for recovery link IMMEDIATELY
    if (location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      if (accessToken && type === 'recovery' && location.pathname !== '/reset-password') {
        console.log('RecoveryLinkInterceptor: Detected recovery link, forcing redirect to /reset-password');
        // Force immediate redirect - this runs BEFORE any route renders
        window.location.replace('/reset-password' + location.hash);
      }
    }
  }, [location.hash, location.pathname]);
  
  return null;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RecoveryLinkInterceptor />
      <FaviconManager />
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/password/:shortCode" element={<PasswordPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* <Route path="/s/:shortCode" element={<Redirect />} /> */}
        <Route path="/statistics/:linkId" element={<Statistics />} />
        <Route path="/statistics" element={<GlobalStatistics />} />
        <Route path="/archives" element={<Archives />} />
        <Route 
          path="/" 
          element={user ? <Index /> : <AuthPage />} 
        />
        {/* Custom domain short links (e.g., 247l.ink/H44F2U) - Must be LAST before NotFound */}
        {/* <Route path="/:shortCode" element={<Redirect />} /> */}
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
