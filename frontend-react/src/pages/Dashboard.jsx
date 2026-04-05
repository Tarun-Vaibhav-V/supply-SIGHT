import { useState, useEffect, useMemo } from 'react';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import {
    getDashboardSummary,
    getLowInventory,
    getDelayedShipments,
    getOrders,
    getRisks,
    getSupplierReliability,
    resolveRisk,
    deleteRisk,
    detectRisks,
} from '../api/data';
import '../styles/dashboard.css';

export default function Dashboard() {
    const { filters } = useFilters();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [summary, setSummary] = useState(null);
    const [lowInv, setLowInv] = useState([]);
    const [delayed, setDelayed] = useState([]);
    const [orders, setOrders] = useState([]);
    const [risks, setRisks] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, [filters.companyId]); // Re-fetch on company change

    const loadData = async () => {
        setLoading(true);
        try {
            const [sumRes, invRes, delRes, ordRes, riskRes, supRes] = await Promise.all([
                getDashboardSummary().catch(() => ({ data: {} })),
                getLowInventory().catch(() => ({ data: [] })),
                getDelayedShipments().catch(() => ({ data: [] })),
                getOrders().catch(() => ({ data: [] })),
                getRisks().catch(() => ({ data: [] })),
                getSupplierReliability().catch(() => ({ data: [] })),
            ]);
            setSummary(sumRes.data);
            setLowInv(invRes.data);
            setDelayed(delRes.data);
            setOrders(ordRes.data);
            setRisks(riskRes.data);
            setSuppliers(supRes.data);
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering logic
    const filteredLowInv = useMemo(() => {
        return lowInv.filter(item => {
            if (filters.companyId && item.company_id != filters.companyId) return false;
            if (filters.search && !item.product_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [lowInv, filters]);

    const filteredDelayed = useMemo(() => {
        return delayed.filter(item => {
            if (filters.companyId && item.company_id != filters.companyId) return false;
            if (filters.search && !item.product_name.toLowerCase().includes(filters.search.toLowerCase()) && !item.supplier_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [delayed, filters]);

    const filteredOrders = useMemo(() => {
        return orders.filter(item => {
            if (filters.companyId && item.company_id != filters.companyId) return false;
            if (filters.status.length > 0 && !filters.status.includes(item.order_status)) return false;
            if (filters.search && !item.product_name.toLowerCase().includes(filters.search.toLowerCase()) && !item.company_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [orders, filters]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(item => {
            if (filters.companyId && item.company_id != filters.companyId) return false;
            if (filters.search && !item.supplier_name.toLowerCase().includes(filters.search.toLowerCase()) && !item.country.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [suppliers, filters]);

    const filteredRisks = useMemo(() => {
        return risks.filter(item => {
            if (filters.companyId && item.company_id != filters.companyId) return false;
            if (filters.severity.length > 0 && !filters.severity.includes(item.risk_severity)) return false;
            if (filters.status.length > 0 && !filters.status.includes(item.resolution_status)) return false;
            if (filters.search && !item.description.toLowerCase().includes(filters.search.toLowerCase()) && !item.risk_type.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [risks, filters]);

    const handleResolve = async (id) => { await resolveRisk(id); loadData(); };
    const handleDismiss = async (id) => { await deleteRisk(id); loadData(); };
    const handleDetect = async () => { await detectRisks(); loadData(); };

    const severityBadge = (s) => {
        const map = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'safe' };
        return <span className={`badge badge-${map[s] || 'info'}`}>{s}</span>;
    };

    const statusBadge = (s) => {
        const map = {
            Delivered: 'safe', Shipped: 'safe',
            Processing: 'info', 'In Transit': 'info',
            Pending: 'warning',
            Delayed: 'danger', Cancelled: 'danger',
            'Low Stock': 'warning', 'Out of Stock': 'danger', 'In Stock': 'safe',
            Open: 'danger', Investigating: 'warning', Resolved: 'safe', Dismissed: 'info',
        };
        return <span className={`badge badge-${map[s] || 'info'}`}>{s}</span>;
    };

    const openRisks = filteredRisks.filter((r) => r.resolution_status === 'Open' || r.resolution_status === 'Investigating');

    return (
        <>
            {/* Insight Banner */}
            {summary && (
                <div className="insight-banner animate-fade-in">
                    {summary.open_risks > 0
                        ? `⚠️ ${summary.open_risks} open risk(s) detected — ${summary.low_inventory_alerts} low inventory, ${summary.delayed_shipment_alerts} delayed shipments`
                        : '✅ All supply chain metrics are healthy!'}
                </div>
            )}

            {/* KPI Cards — Row 1: Counts */}
            <section className="kpi-grid">
                {[
                    { label: isAdmin ? 'Companies' : 'My Company', value: summary?.total_companies, icon: '🏢' },
                    { label: isAdmin ? 'Suppliers' : 'My Suppliers', value: summary?.total_suppliers, icon: '👥' },
                    { label: isAdmin ? 'Products' : 'My Products', value: summary?.total_products, icon: '📦' },
                    { label: 'Warehouses', value: summary?.total_warehouses, icon: '🏭' },
                ].map((kpi, i) => (
                    <div className="kpi-card animate-fade-in" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
                        <div className="kpi-icon" style={{ fontSize: '1.4rem' }}>{kpi.icon}</div>
                        <div>
                            <span className="kpi-value">
                                {loading ? <span className="skeleton-kpi"></span> : kpi.value ?? '—'}
                            </span>
                            <span className="kpi-label">{kpi.label}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* KPI Cards — Row 2: Alerts */}
            <section className="kpi-grid">
                {[
                    { label: 'Low Inventory', value: summary?.low_inventory_alerts, icon: '⚠️', type: 'warning' },
                    { label: 'Delayed Shipments', value: summary?.delayed_shipment_alerts, icon: '🚚', type: 'danger' },
                    { label: 'Total Orders', value: summary?.total_orders, icon: '📋', type: 'info' },
                    { label: 'Open Risks', value: summary?.open_risks, icon: '🛡️', type: 'danger' },
                ].map((kpi, i) => (
                    <div className="kpi-card animate-fade-in" key={i} style={{ animationDelay: `${(i + 4) * 0.08}s` }}>
                        <div className={`kpi-icon icon-${kpi.type}`} style={{ fontSize: '1.4rem' }}>{kpi.icon}</div>
                        <div>
                            <span className="kpi-value">
                                {loading ? <span className="skeleton-kpi"></span> : kpi.value ?? '—'}
                            </span>
                            <span className="kpi-label">{kpi.label}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* ─── Risk Alert Cards ────────────────────────── */}
            <div className="section-title">⚠️ Risk Alerts</div>
            <section className="grid-2col">
                {/* Low Inventory Cards */}
                <div className="card">
                    <div className="card-header">
                        <h2>📉 Low Inventory</h2>
                        <span className="badge badge-warning">{filteredLowInv.length}</span>
                    </div>
                    <div className="data-cards-grid">
                        {filteredLowInv.length === 0 ? (
                            <div className="empty-state">✅ All inventory healthy</div>
                        ) : filteredLowInv.map((item, i) => (
                            <div className="data-card" key={i}>
                                <div className="data-card-top">
                                    <span className="data-card-title">{item.product_name}</span>
                                    {statusBadge(item.inventory_status)}
                                </div>
                                <div className="data-card-meta">📍 {item.warehouse_name}</div>
                                <div className="stock-gauge">
                                    <div className="stock-gauge-bar">
                                        <div
                                            className="stock-gauge-fill"
                                            style={{
                                                width: `${Math.min((item.quantity_available / item.minimum_threshold) * 100, 100)}%`,
                                                background: item.quantity_available < item.minimum_threshold * 0.3 ? 'var(--danger)' : 'var(--warning)',
                                            }}
                                        ></div>
                                    </div>
                                    <span className="stock-gauge-text">{item.quantity_available} / {item.minimum_threshold}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delayed Shipment Cards */}
                <div className="card">
                    <div className="card-header">
                        <h2>🚚 Delayed Shipments</h2>
                        <span className="badge badge-danger">{filteredDelayed.length}</span>
                    </div>
                    <div className="data-cards-grid">
                        {filteredDelayed.length === 0 ? (
                            <div className="empty-state">✅ No delayed shipments</div>
                        ) : filteredDelayed.map((sh, i) => (
                            <div className="data-card" key={i}>
                                <div className="data-card-top">
                                    <span className="data-card-title">#{sh.shipment_id} — {sh.product_name}</span>
                                    <span className="badge badge-danger">{sh.days_overdue}d late</span>
                                </div>
                                <div className="data-card-meta">🤝 {sh.supplier_name}</div>
                                <div className="data-card-meta">📅 Expected: {sh.expected_delivery_date}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Recent Orders (Cards) ──────────────────── */}
            <div className="section-title">📋 Recent Orders</div>
            <section className="data-cards-grid-wide">
                {filteredOrders.slice(0, 8).map((o, i) => (
                    <div className="data-card" key={i}>
                        <div className="data-card-top">
                            <span className="data-card-title">Order #{o.order_id}</span>
                            {severityBadge(o.priority_level)}
                        </div>
                        <div className="data-card-meta">🏢 {o.company_name} → 📦 {o.product_name}</div>
                        <div className="data-card-meta">📦 {o.order_quantity} units</div>
                        <div className="data-card-bottom">
                            <span className="data-card-meta">📅 {o.order_date}</span>
                            {statusBadge(o.order_status)}
                        </div>
                    </div>
                ))}
            </section>

            {/* ─── Supplier Reliability Cards ──────────────── */}
            <div className="section-title">🤝 Supplier Reliability</div>
            <section className="data-cards-grid-wide">
                {filteredSuppliers.map((s, i) => (
                    <div className="data-card" key={i}>
                        <div className="data-card-top">
                            <span className="data-card-title">{s.supplier_name}</span>
                            <span className="badge badge-info">{s.country}</span>
                        </div>
                        <div className="data-card-meta">🏢 {s.company_name}</div>
                        <div className="stock-gauge" style={{ marginTop: '8px' }}>
                            <div className="stock-gauge-bar">
                                <div
                                    className="stock-gauge-fill"
                                    style={{
                                        width: `${(s.reliability_score || 0) * 100}%`,
                                        background: s.reliability_score >= 0.8 ? 'var(--safe)' : s.reliability_score >= 0.6 ? 'var(--warning)' : 'var(--danger)',
                                    }}
                                ></div>
                            </div>
                            <span className="stock-gauge-text">{((s.reliability_score || 0) * 100).toFixed(0)}% reliable</span>
                        </div>
                        <div className="data-card-bottom" style={{ marginTop: '6px' }}>
                            <span className="data-card-meta">⏱️ {s.lead_time_days}d lead</span>
                            <span className="data-card-meta">✅ {s.delivered} / 🔴 {s.delayed}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* ─── Risk Events Cards ──────────────────────── */}
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🛡️ Risk Events Log</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-danger">{openRisks.length} open</span>
                    {isAdmin && <button className="btn btn-gold" onClick={handleDetect} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                        🔍 Scan
                    </button>}
                </div>
            </div>
            <section className="data-cards-grid-wide" style={{ marginBottom: '40px' }}>
                {filteredRisks.map((r, i) => (
                    <div className={`data-card risk-card-${r.risk_severity?.toLowerCase()}`} key={i}>
                        <div className="data-card-top">
                            <span className="data-card-title">#{r.risk_id} — {r.risk_type}</span>
                            {severityBadge(r.risk_severity)}
                        </div>
                        <div className="data-card-meta">{r.entity_type} #{r.entity_id}</div>
                        <div className="data-card-desc">{r.description}</div>
                        <div className="data-card-bottom">
                            <span className="data-card-meta">📅 {r.detected_date}</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {statusBadge(r.resolution_status)}
                                {(r.resolution_status === 'Open' || r.resolution_status === 'Investigating') && (
                                    <>
                                        <button className="btn btn-outline" style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                            onClick={() => handleResolve(r.risk_id)}>✓</button>
                                        <button className="btn btn-danger" style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                                            onClick={() => handleDismiss(r.risk_id)}>✕</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </section>
        </>
    );
}
