import React, { useState } from 'react';
import { X, Mail, Lock, User, KeyRound, ArrowRight, ArrowLeft } from 'lucide-react';
import { apiRequest } from '../utils/api';

export default function AuthModal({ initialMode = 'login', onClose, onSuccess, showToast }) {
  // Modes: 'login' | 'register' | 'verify-otp' | 'forgot-password' | 'reset-password'
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (data?.token && data?.user) {
        onSuccess(data);
      } else {
        showToast('Sign in failed. Please try again.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Invalid email or password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (data?.requiresOtp) {
        if (data.email) setEmail(data.email);
        setOtp('');
        setMode('verify-otp');
        showToast(data.message || 'A 6-digit verification code has been sent to your email.');
      } else if (data?.token && data?.user) {
        onSuccess(data);
      }
    } catch (err) {
      showToast(err.message || 'Could not create account. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
        }),
      });

      if (data?.token && data?.user) {
        showToast('Email verified! Welcome to Single Choice.');
        onSuccess(data);
      } else {
        showToast('Verification failed. Please check the code.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Invalid or expired verification code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      if (data?.email) setEmail(data.email);
      setOtp('');
      setNewPassword('');
      setMode('reset-password');
      showToast(data?.message || '6-digit reset code sent to your email.');
    } catch (err) {
      showToast(err.message || 'No account found with this email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          newPassword,
        }),
      });
      showToast(data?.message || 'Password updated. Please sign in.');
      setPassword('');
      setOtp('');
      setMode('login');
    } catch (err) {
      showToast(err.message || 'Failed to reset password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 3500 }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="product-modal"
        style={{ maxWidth: '440px', padding: '32px 28px', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="modal-close-circle"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '22px', textAlign: 'center' }}>
          <span className="eyebrow-gold">SINGLE CHOICE CLIENTELE</span>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '26px',
              color: 'var(--forest-green)',
              marginTop: '4px',
            }}
          >
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && 'Create an Account'}
            {mode === 'verify-otp' && 'Verify Your Email'}
            {mode === 'forgot-password' && 'Reset Password'}
            {mode === 'reset-password' && 'Enter Reset Code'}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {mode === 'login' &&
              'Sign in to access your saved shopping bag and Lagos dispatch orders.'}
            {mode === 'register' &&
              'Join Single Choice for seamless checkout and order tracking.'}
            {mode === 'verify-otp' &&
              `We sent a 6-digit verification code to ${email}. Enter it below to activate your account.`}
            {mode === 'forgot-password' &&
              'Enter your registered email address to receive a 6-digit reset code.'}
            {mode === 'reset-password' &&
              `Enter the 6-digit code sent to ${email} and choose a new password.`}
          </p>
        </div>

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                Email Address *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Password *</label>
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--forest-green)',
                    textDecoration: 'underline',
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary full-width" disabled={loading} style={{ marginTop: '6px' }}>
              {loading ? 'Signing In...' : 'Sign In'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                Full Name *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                Email Address *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                Password (min 6 characters) *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary full-width" disabled={loading} style={{ marginTop: '6px' }}>
              {loading ? 'Sending Verification Code...' : 'Create Account'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* 6-DIGIT OTP VERIFICATION FORM */}
        {mode === 'verify-otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                6-Digit Verification Code *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '18px',
                    letterSpacing: '0.28em',
                    fontWeight: '700',
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary full-width" disabled={loading || otp.length < 6}>
              {loading ? 'Verifying...' : 'Verify & Sign In'}
              {!loading && <ArrowRight size={16} />}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setMode('register')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12.5px',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ArrowLeft size={14} /> Edit details
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleRegister}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12.5px',
                  color: 'var(--forest-green)',
                  fontWeight: '600',
                  textDecoration: 'underline',
                }}
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                Registered Email Address *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary full-width" disabled={loading}>
              {loading ? 'Sending Reset Code...' : 'Send 6-Digit Reset Code'}
            </button>

            <button
              type="button"
              onClick={() => setMode('login')}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '13px',
                color: 'var(--text-muted)',
                marginTop: '4px',
              }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                6-Digit Reset Code *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '16px',
                    letterSpacing: '0.25em',
                    fontWeight: '700',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' }}>
                New Password (min 6 characters) *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary full-width" disabled={loading}>
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* FOOTER TOGGLE */}
        {(mode === 'login' || mode === 'register') && (
          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center',
              fontSize: '13.5px',
              color: 'var(--text-muted)',
            }}
          >
            {mode === 'login' ? (
              <>
                New to Single Choice?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--forest-green)',
                    fontWeight: '700',
                    textDecoration: 'underline',
                  }}
                >
                  Create an Account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--forest-green)',
                    fontWeight: '700',
                    textDecoration: 'underline',
                  }}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}