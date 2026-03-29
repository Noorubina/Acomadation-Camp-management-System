import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css'; // We'll create this CSS file for enhanced styling

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Determine API URL based on environment
    // Priority: VITE_API_URL > hostname detection > fallback
    let apiUrl;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const environment = isLocalhost ? 'development' : 'production';

    if (import.meta.env.VITE_API_URL) {
      // Use environment variable if set (highest priority)
      apiUrl = import.meta.env.VITE_API_URL;
    } else {
      // Detect environment based on hostname
      const isLocalNetwork = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');

      if (isLocalhost || isLocalNetwork) {
        apiUrl = 'http://localhost:5000';
      } else if (hostname.includes('render.com')) {
        // Production on Render
        apiUrl = 'https://naajco-camp.onrender.com';
      } else {
        // Fallback for other environments
        apiUrl = 'https://naajco-camp.onrender.com';
      }
    }

    console.log('🔍 DEBUG - Environment:', environment);
    console.log('🔍 DEBUG - Hostname:', hostname);
    console.log('🔍 DEBUG - VITE_API_URL:', import.meta.env.VITE_API_URL);
    console.log('🔍 DEBUG - Resolved API URL:', apiUrl);
    console.log('🔍 DEBUG - Full endpoint:', `${apiUrl}/api/auth/login`);

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setErrors({ general: data.message || 'Login failed' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-overlay"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-icon">🏢</div>
            <h1>Naajco Arabia Camp and Catering</h1>
          </div>
          <p className="login-subtitle">Camp Management System</p>
        </div>

        {errors.general && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              📧 Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="Enter your email address"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              🔒 Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="button-spinner"></span>
                Logging in...
              </>
            ) : (
              '🚀 Login to Dashboard'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Secure access to your camp management portal</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
