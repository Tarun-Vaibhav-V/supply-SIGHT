import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    getCompanies,
    getSuppliers,
    getProducts,
    getShipments,
    getRisks,
    getInventory,
    getSupplierReliability,
} from '../api/data';
import '../styles/dashboard.css';

export default function CompanyDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const companyId = parseInt(id, 10);
    const [company, setCompany] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [risks, setRisks] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [reliability, setReliability] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [compRes, suppRes, prodRes, shipRes, riskRes, invRes, relRes] = await Promise.all([
                getCompanies().catch(() => ({ data: [] })),
                getSuppliers().catch(() => ({ data: [] })),
                getProducts().catch(() => ({ data: [] })),
                getShipments().catch(() => ({ data: [] })),
                getRisks().catch(() => ({ data: [] })),
                getInventory().catch(() => ({ data: [] })),
                getSupplierReliability().catch(() => ({ data: [] })),
            ]);

            const comp = compRes.data.find((c) => c.company_id === companyId);
            setCompany(comp || null);
            setSuppliers((suppRes.data || []).filter((s) => s.company_id === companyId));
            setProducts((prodRes.data || []).filter((p) => p.company_id === companyId));
            setShipments((shipRes.data || []).filter((sh) => sh.company_id === companyId));
            setRisks((riskRes.data || []).filter((r) => r.company_id === companyId));
            setInventory((invRes.data || []).filter((inv) => inv.company_id === companyId));
            setReliability((relRes.data || []).filter((r) => r.company_id === companyId));
        } finally {
            setLoading(false);
        }
    };

    const healthScore = () => {
        let avgRel = 0;
        if (reliability.length > 0) {
            avgRel = reliability.reduce((sum, r) => sum + (r.reliability_score || 0), 0) / reliability.length;
        }
        const onTime = shipments.length > 0
            ? (shipments.length - shipments.filter((s) => s.shipment_status === 'Delayed').length) / shipments.length
            : 1;
        const openRisks = risks.filter((r) => r.resolution_status === 'Open' || r.resolution_status === 'Investigating').length;
        const riskPenalty = Math.min(0.3, openRisks * 0.05);
        return Math.max(0, Math.min(100, Math.round(((avgRel * 0.5 + onTime * 0.5) - riskPenalty) * 100)));
    };

    const healthColor = (s) => s >= 80 ? 'var(--safe)' : s >= 60 ? 'var(--warning)' : 'var(--danger)';
    const statusBadge = (s) => {
        const map = {
            Delivered: 'safe', Shipped: 'safe', 'In Transit': 'info',
            Pending: 'warning', Delayed: 'danger', Cancelled: 'danger',
            Open: 'danger', Investigating: 'warning', Resolved: 'safe', Dismissed: 'info',
        };
        return <span className={`badge badge-${map[s] || 'info'}`}>{s}</span>;
    };
    const severityBadge = (s) => {
        const map = { Critical: 'danger', High: 'warning', Medium: 'info', Low: 'safe' };
        return <span className={`badge badge-${map[s] || 'info'}`}>{s}</span>;
    };

    if (loading) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading company details...</div>;
    }

    if (!company) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>Company not found</h2>
                <button className="btn btn-gold" onClick={() => navigate('/map')} style={{ marginTop: 16 }}>
                    ← Back to Map
                </button>
            </div>
        );
    }

    const health = healthScore();

    return (
        <div className="animate-fade-in">
            {/* Back + Header */}
            <div style={{ marginBottom: 24 }}>
                <button
                    className="btn btn-outline"
                    onClick={() => navigate('/map')}
                    style={{ marginBottom: 14, fontSize: '0.82rem', padding: '6px 14px' }}
                >
                    ← Back to Map
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>
                            🏢 {company.company_name}
                        </h1>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                            {company.industry} • {company.headquarters} • {company.contact_email}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Health Score</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: healthColor(health) }}>{health}%</div>
                        </div>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            border: `3px solid ${healthColor(health)}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem',
                        }}>🏢</div>
                    </div>
                </div>
            </div>

            {/* Mini Pipeline */}
            <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    {[
                        { icon: '👥', label: 'Suppliers', count: suppliers.length },
                        { icon: '📦', label: 'Products', count: products.length },
                        { icon: '📊', label: 'Inventory', count: inventory.length },
                        { icon: '🚚', label: 'Shipments', count: shipments.length },
                        { icon: '🛡️', label: 'Risks', count: risks.length },
                    ].map((s, i) => (
                        <div key={i} style={{ textAlign: 'center', minWidth: 70 }}>
                            <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold)' }}>{s.count}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* KPI Row */}
            <section className="kpi-grid">
                {[
                    { label: 'Suppliers', value: suppliers.length, icon: '👥' },
                    { label: 'Products', value: products.length, icon: '📦' },
                    { label: 'Active Shipments', value: shipments.filter((s) => s.shipment_status !== 'Delivered').length, icon: '🚚' },
                    { label: 'Open Risks', value: risks.filter((r) => r.resolution_status === 'Open').length, icon: '⚠️' },
                ].map((kpi, i) => (
                    <div className="kpi-card" key={i}>
                        <div className="kpi-icon" style={{ fontSize: '1.4rem' }}>{kpi.icon}</div>
                        <div>
                            <span className="kpi-value">{kpi.value}</span>
                            <span className="kpi-label">{kpi.label}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* Supplier Reliability + Inventory in 2-col */}
            <div className="grid-2col">
                {/* Suppliers */}
                <div className="card">
                    <div className="card-header">
                        <h2>👥 Suppliers ({suppliers.length})</h2>
                    </div>
                    <div className="data-cards-grid">
                        {suppliers.length === 0 ? (
                            <div className="empty-state">No suppliers</div>
                        ) : reliability.map((s, i) => (
                            <div className="data-card" key={i}>
                                <div className="data-card-top">
                                    <span className="data-card-title">{s.supplier_name}</span>
                                    <span className="badge badge-info">{s.country}</span>
                                </div>
                                <div className="stock-gauge" style={{ marginTop: '6px' }}>
                                    <div className="stock-gauge-bar">
                                        <div className="stock-gauge-fill" style={{
                                            width: `${(s.reliability_score || 0) * 100}%`,
                                            background: s.reliability_score >= 0.8 ? 'var(--safe)' : s.reliability_score >= 0.6 ? 'var(--warning)' : 'var(--danger)',
                                        }}></div>
                                    </div>
                                    <span className="stock-gauge-text">{((s.reliability_score || 0) * 100).toFixed(0)}%</span>
                                </div>
                                <div className="data-card-bottom">
                                    <span className="data-card-meta">⏱️ {s.lead_time_days}d</span>
                                    <span className="data-card-meta">✅ {s.delivered} • 🔴 {s.delayed}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Inventory */}
                <div className="card">
                    <div className="card-header">
                        <h2>📊 Inventory ({inventory.length})</h2>
                    </div>
                    <div className="data-cards-grid">
                        {inventory.length === 0 ? (
                            <div className="empty-state">No inventory data</div>
                        ) : inventory.map((inv, i) => (
                            <div className="data-card" key={i}>
                                <div className="data-card-top">
                                    <span className="data-card-title">{inv.product_name || `Product #${inv.product_id}`}</span>
                                    {statusBadge(inv.inventory_status || (inv.quantity_available < (inv.minimum_threshold || 0) ? 'Low Stock' : 'In Stock'))}
                                </div>
                                <div className="data-card-meta">📍 {inv.warehouse_name || `Warehouse #${inv.warehouse_id}`}</div>
                                <div className="stock-gauge" style={{ marginTop: '6px' }}>
                                    <div className="stock-gauge-bar">
                                        <div className="stock-gauge-fill" style={{
                                            width: `${Math.min((inv.quantity_available / Math.max(inv.minimum_threshold || 100, 1)) * 100, 100)}%`,
                                            background: inv.quantity_available < (inv.minimum_threshold || 0) ? 'var(--danger)' : 'var(--safe)',
                                        }}></div>
                                    </div>
                                    <span className="stock-gauge-text">{inv.quantity_available} units</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Shipments */}
            <div className="section-title">🚚 Shipments ({shipments.length})</div>
            <section className="data-cards-grid-wide">
                {shipments.length === 0 ? (
                    <div className="empty-state">No shipments</div>
                ) : shipments.map((sh, i) => (
                    <div className="data-card" key={i}>
                        <div className="data-card-top">
                            <span className="data-card-title">#{sh.shipment_id}</span>
                            {statusBadge(sh.shipment_status)}
                        </div>
                        <div className="data-card-meta">📦 {sh.product_name || `Product #${sh.product_id}`} • Qty: {sh.quantity_shipped}</div>
                        <div className="data-card-bottom">
                            <span className="data-card-meta">📅 {sh.ship_date} → {sh.expected_delivery_date}</span>
                        </div>
                    </div>
                ))}
            </section>

            {/* Risks */}
            <div className="section-title">🛡️ Risk Events ({risks.length})</div>
            <section className="data-cards-grid-wide" style={{ marginBottom: 40 }}>
                {risks.length === 0 ? (
                    <div className="empty-state">No risk events — looking good!</div>
                ) : risks.map((r, i) => (
                    <div className={`data-card risk-card-${r.risk_severity?.toLowerCase()}`} key={i}>
                        <div className="data-card-top">
                            <span className="data-card-title">#{r.risk_id} — {r.risk_type}</span>
                            {severityBadge(r.risk_severity)}
                        </div>
                        <div className="data-card-desc">{r.description}</div>
                        <div className="data-card-bottom">
                            <span className="data-card-meta">📅 {r.detected_date}</span>
                            {statusBadge(r.resolution_status)}
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}
