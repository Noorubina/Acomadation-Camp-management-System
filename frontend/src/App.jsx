import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChangePassword from './components/ChangePassword'; 
import SplashScreen from './components/SplashScreen';
import { useState, useEffect } from 'react';
import './responsive.css';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Only show splash screen on initial load or when on login page
    if (location.pathname === '/login' || location.pathname === '/') {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      setShowSplash(false);
    }
  }, [location.pathname]);

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/change-password" element={<ChangePassword />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="app-container">
      <Router>
        <AppContent />
      </Router>
    </div>
  );
}

export default App;
