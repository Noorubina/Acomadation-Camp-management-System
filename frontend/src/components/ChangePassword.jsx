import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ChangePassword.css'; // We'll create this CSS file

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const newErrors = {};
    if (!formData.currentPassword) newErrors.currentPassword = 'Current password is required';
    if (!formData.newPassword) newErrors.newPassword = 'New password is required';
    if (formData.newPassword.length < 6) newErrors.newPassword = 'Password must be at least 6 characters';
    if (formData.newPassword !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setErrors({ general: data.message || 'Password change failed' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/dashboard');
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="change-password-container">
      <div className="change-password-background">
        <div className="change-password-overlay"></div>
      </div>
      
      <div className="change-password-card">
        {/* Header */}
        <div className="change-password-header">
          <div className="password-icon">🔒</div>
          <h1>Change Password</h1>
          <p>Update your account security</p>
        </div>

        {/* Navigation Buttons */}
        <div className="navigation-buttons">
          <button 
            onClick={handleGoBack}
            className="btn btn-secondary"
          >
            ← Back to Dashboard
          </button>
          <button 
            onClick={handleGoToLogin}
            className="btn btn-outline"
          >
            Go to Login
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            Password changed successfully! Redirecting...
          </div>
        )}

        {/* Error Message */}
        {errors.general && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {errors.general}
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="password-form">
          <div className="form-group">
            <label htmlFor="currentPassword" className="form-label">
              🔑 Current Password
            </label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              className={`form-input ${errors.currentPassword ? 'error' : ''}`}
              placeholder="Enter your current password"
              disabled={loading || success}
            />
            {errors.currentPassword && (
              <span className="error-text">
                {errors.currentPassword}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="newPassword" className="form-label">
              🆕 New Password
            </label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className={`form-input ${errors.newPassword ? 'error' : ''}`}
              placeholder="Enter your new password (min. 6 characters)"
              disabled={loading || success}
            />
            {errors.newPassword && (
              <span className="error-text">
                {errors.newPassword}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              ✅ Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              placeholder="Confirm your new password"
              disabled={loading || success}
            />
            {errors.confirmPassword && (
              <span className="error-text">
                {errors.confirmPassword}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button 
              type="submit" 
              disabled={loading || success}
              className={`btn btn-primary ${loading ? 'loading' : ''} ${success ? 'success' : ''}`}
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Changing...
                </>
              ) : success ? (
                '✅ Changed!'
              ) : (
                'Change Password'
              )}
            </button>
            
            <button 
              type="button"
              onClick={handleGoBack}
              className="btn btn-outline"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Security Tips */}
        <div className="security-tips">
          <h4>🔒 Password Security Tips</h4>
          <ul>
            <li>Use at least 8 characters for better security</li>
            <li>Include numbers, uppercase, and special characters</li>
            <li>Avoid common words or personal information</li>
            <li>Consider using a password manager</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
