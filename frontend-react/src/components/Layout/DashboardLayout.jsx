import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFilters } from '../../context/FilterContext';
import { getDropdownCompanies } from '../../api/data';
import ChatPanel from '../ChatPanel';
import '../../styles/layout.css';

const NAV_ITEMS = [
    { to: '/dashboard', icon: '📊', label: 'Overview' },
    { to: '/pipeline', icon: '🔗', label: 'Pipeline' },
    { to: '/map', icon: '🗺️', label: 'Company Map' },
];

const STATUS_CHIPS = ['Active', 'Delivered', 'In Transit', 'Delayed', 'Pending', 'Cancelled'];
const SEVERITY_CHIPS = ['Critical', 'High', 'Medium', 'Low'];

export default function DashboardLayout() {
    const { user, logout } = useAuth();
    const { filters, updateFilter, toggleChip, resetFilters } = useFilters();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        getDropdownCompanies()
            .then((res) => setCompanies(res.data))
            .catch(() => { });
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const initials = user?.full_name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '??';

    return (
        <div className="app-layout">
            {/* ─── Sidebar ──────────────────────────────────── */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">⚡ SupplySight</div>
                    <div className="sidebar-subtitle">Supply Chain Intelligence</div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    <div className="sidebar-label">Views</div>
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Filters */}
                <div className="sidebar-filters">
                    <div className="sidebar-label" style={{ padding: '12px 12px 4px' }}>Filters</div>

                    {/* Company Filter */}
                    {user?.role === 'admin' && (
                        <div className="filter-group">
                            <div className="filter-label">Company</div>
                            <select
                                className="filter-select"
                                value={filters.companyId}
                                onChange={(e) => updateFilter('companyId', e.target.value)}
                            >
                                <option value="">All Companies</option>
                                {companies.map((c) => (
                                    <option key={c.company_id} value={c.company_id}>
                                        {c.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Status Chips */}
                    <div className="filter-group">
                        <div className="filter-label">Status</div>
                        <div className="chip-group">
                            {STATUS_CHIPS.map((s) => (
                                <button
                                    key={s}
                                    className={`chip${filters.status.includes(s) ? ' selected' : ''}`}
                                    onClick={() => toggleChip('status', s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Severity Chips */}
                    <div className="filter-group">
                        <div className="filter-label">Severity</div>
                        <div className="chip-group">
                            {SEVERITY_CHIPS.map((s) => (
                                <button
                                    key={s}
                                    className={`chip${filters.severity.includes(s) ? ' selected' : ''}`}
                                    onClick={() => toggleChip('severity', s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="filter-group">
                        <div className="filter-label">Search</div>
                        <input
                            type="text"
                            className="filter-search"
                            placeholder="Search products, suppliers..."
                            value={filters.search}
                            onChange={(e) => updateFilter('search', e.target.value)}
                        />
                    </div>

                    {/* Reset */}
                    {(filters.companyId || filters.status.length > 0 || filters.severity.length > 0 || filters.search) && (
                        <button
                            className="btn btn-outline"
                            onClick={resetFilters}
                            style={{ margin: '14px 12px 0', fontSize: '0.78rem', padding: '6px 12px' }}
                        >
                            ✕ Clear filters
                        </button>
                    )}
                </div>

                {/* User Footer */}
                <div className="sidebar-footer">
                    <div className="sidebar-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.full_name}</div>
                        <div className="sidebar-user-role">
                            {user?.role === 'admin' ? '🛡️ Admin' : '🏢 Company'}
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={handleLogout} title="Sign out">
                        ⏻
                    </button>
                </div>
            </aside>

            {/* ─── Main Content ─────────────────────────────── */}
            <div className="main-content">
                <header className="content-topbar">
                    <div className="topbar-actions" style={{ marginLeft: 'auto' }}>
                        <div className="pulse-indicator">
                            <span className="pulse-dot"></span>
                            <span>Live</span>
                        </div>
                        {user?.role === 'admin' && (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>ADMIN</span>
                        )}
                    </div>
                </header>

                <div className="content-area">
                    <Outlet />
                </div>
            </div>

            {/* Chat FAB */}
            <ChatPanel />
        </div>
    );
}
