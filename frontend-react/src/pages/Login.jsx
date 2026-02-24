import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser, googleLogin } from '../api/auth';
import '../styles/auth.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    // ─── Google Sign-In callback ──────────────────────────
    const handleGoogleResponse = useCallback(
        async (response) => {
            setError('');
            setLoading(true);
            try {
                const res = await googleLogin(response.credential);
                login(res.data, res.data.user);
                navigate('/dashboard');
            } catch (err) {
                setError(err.response?.data?.detail || 'Google Sign-In failed');
            } finally {
                setLoading(false);
            }
        },
        [login, navigate]
    );

    // ─── Initialize Google Identity Services ──────────────
    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) return;

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.google?.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleResponse,
            });
            window.google?.accounts.id.renderButton(
                document.getElementById('google-signin-btn'),
                {
                    type: 'standard',
                    shape: 'rectangular',
                    theme: 'filled_black',
                    text: 'signin_with',
                    size: 'large',
                    width: '100%',
                }
            );
        };
        document.head.appendChild(script);
        return () => {
            document.head.removeChild(script);
        };
    }, [handleGoogleResponse]);

    // ─── Email/Password login ─────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await loginUser(email, password);
            login(res.data, res.data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-ambient-glow"></div>
            <div className="auth-card">
                <div className="auth-header">
                    <h1 className="auth-logo">⚡ SupplySight</h1>
                    <p className="auth-subtitle">Sign in to your account</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button className="btn btn-gold auth-submit" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                {/* Google Sign-In button — rendered by GIS library */}
                <div id="google-signin-btn" className="google-btn-container"></div>

                {/* Fallback if no GOOGLE_CLIENT_ID */}
                {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                    <button className="btn google-btn" disabled style={{ opacity: 0.5 }}>
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
                            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
                            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.462.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" />
                        </svg>
                        Google Sign-In (not configured)
                    </button>
                )}

                <p className="auth-footer">
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </div>
        </div>
    );
}
