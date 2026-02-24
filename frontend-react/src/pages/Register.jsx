import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser, getCompaniesDropdown } from '../api/auth';
import '../styles/auth.css';

export default function Register() {
    const [form, setForm] = useState({
        full_name: '',
        email: '',
        password: '',
        company_id: '',
        admin_invite_code: '',
    });
    const [isAdmin, setIsAdmin] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        getCompaniesDropdown()
            .then((res) => setCompanies(res.data))
            .catch(() => { });
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                email: form.email,
                password: form.password,
                full_name: form.full_name,
            };

            if (isAdmin) {
                payload.admin_invite_code = form.admin_invite_code;
            } else {
                payload.company_id = parseInt(form.company_id);
                if (!payload.company_id) {
                    setError('Please select a company');
                    setLoading(false);
                    return;
                }
            }

            const res = await registerUser(payload);
            login(res.data, res.data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-logo">
                    <h1>⚡ SupplySight</h1>
                    <p>Supply Chain Intelligence Platform</p>
                </div>

                <div className="auth-card">
                    <h2>Create account</h2>
                    <p className="subtitle">Get started with your supply chain dashboard</p>

                    {error && <div className="auth-error">{error}</div>}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input
                                type="text"
                                name="full_name"
                                className="form-input"
                                placeholder="John Doe"
                                value={form.full_name}
                                onChange={handleChange}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                name="email"
                                className="form-input"
                                placeholder="you@company.com"
                                value={form.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                name="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={form.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>

                        <label className="admin-toggle">
                            <input
                                type="checkbox"
                                checked={isAdmin}
                                onChange={(e) => setIsAdmin(e.target.checked)}
                            />
                            I have an admin invite code
                        </label>

                        {isAdmin ? (
                            <div className="form-group">
                                <label className="form-label">Admin Invite Code</label>
                                <input
                                    type="text"
                                    name="admin_invite_code"
                                    className="form-input"
                                    placeholder="Enter invite code"
                                    value={form.admin_invite_code}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        ) : (
                            <div className="form-group">
                                <label className="form-label">Company</label>
                                <select
                                    name="company_id"
                                    className="form-input"
                                    value={form.company_id}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select your company</option>
                                    {companies.map((c) => (
                                        <option key={c.company_id} value={c.company_id}>
                                            {c.company_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-gold btn-lg"
                            disabled={loading}
                            style={{ width: '100%', marginTop: '8px' }}
                        >
                            {loading ? <span className="spinner"></span> : 'Create Account'}
                        </button>
                    </form>
                </div>

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
