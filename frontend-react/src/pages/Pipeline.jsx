import { useState, useEffect, useMemo } from 'react';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import {
    getCompanies,
    getSuppliers,
    getProducts,
    getWarehouses,
    getShipments,
    getDashboardSummary,
} from '../api/data';
import '../styles/pipeline.css';

const STAGES = [
    { key: 'companies', icon: '🏢', label: 'Companies' },
    { key: 'suppliers', icon: '👥', label: 'Suppliers' },
    { key: 'products', icon: '📦', label: 'Products' },
    { key: 'warehouses', icon: '🏭', label: 'Warehouses' },
    { key: 'shipments', icon: '🚚', label: 'Shipments' },
];

export default function Pipeline() {
    const { filters } = useFilters();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const stages = isAdmin ? STAGES : STAGES.filter(s => s.key !== 'companies');
    const [data, setData] = useState({});
    const [summary, setSummary] = useState(null);
    const [activeStage, setActiveStage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [filters.companyId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [comp, supp, prod, ware, ship, sum] = await Promise.all([
                getCompanies().catch(() => ({ data: [] })),
                getSuppliers().catch(() => ({ data: [] })),
                getProducts().catch(() => ({ data: [] })),
                getWarehouses().catch(() => ({ data: [] })),
                getShipments().catch(() => ({ data: [] })),
                getDashboardSummary().catch(() => ({ data: {} })),
            ]);
            setData({
                companies: comp.data,
                suppliers: supp.data,
                products: prod.data,
                warehouses: ware.data,
                shipments: ship.data,
            });
            setSummary(sum.data);
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering
    const filteredData = useMemo(() => {
        const result = {
            companies: (data.companies || []).filter(c => !filters.companyId || c.company_id == filters.companyId),
            suppliers: (data.suppliers || []).filter(s => !filters.companyId || s.company_id == filters.companyId),
            products: (data.products || []).filter(p => !filters.companyId || p.company_id == filters.companyId),
            warehouses: (data.warehouses || []), // Warehouses usually global
            shipments: (data.shipments || []).filter(sh => {
                if (filters.companyId && sh.company_id != filters.companyId) return false;
                if (filters.status.length > 0 && !filters.status.includes(sh.shipment_status)) return false;
                return true;
            }),
        };

        // Apply general search across all stages if active
        if (filters.search) {
            const s = filters.search.toLowerCase();
            result.companies = result.companies.filter(c => c.company_name.toLowerCase().includes(s));
            result.suppliers = result.suppliers.filter(sup => sup.supplier_name.toLowerCase().includes(s));
            result.products = result.products.filter(p => p.product_name.toLowerCase().includes(s));
            result.shipments = result.shipments.filter(sh => sh.product_name?.toLowerCase().includes(s) || sh.supplier_name?.toLowerCase().includes(s));
        }

        return result;
    }, [data, filters]);

    const getCounts = () => ({
        companies: filteredData.companies?.length || 0,
        suppliers: filteredData.suppliers?.length || 0,
        products: filteredData.products?.length || 0,
        warehouses: filteredData.warehouses?.length || 0,
        shipments: filteredData.shipments?.length || 0,
    });

    const getHealth = (key) => {
        if (!summary) return { green: 0, yellow: 0, red: 0 };
        switch (key) {
            case 'companies':
                return { green: getCounts().companies, yellow: 0, red: 0 };
            case 'suppliers':
                return { green: getCounts().suppliers, yellow: 0, red: 0 };
            case 'products':
                return { green: getCounts().products - (summary.low_inventory_alerts || 0), yellow: summary.low_inventory_alerts || 0, red: 0 };
            case 'warehouses':
                return { green: getCounts().warehouses, yellow: 0, red: 0 };
            case 'shipments': {
                const del = summary.delayed_shipment_alerts || 0;
                return { green: getCounts().shipments - del, yellow: 0, red: del };
            }
            default:
                return { green: 0, yellow: 0, red: 0 };
        }
    };

    const getStat = (key) => {
        if (!summary) return '';
        switch (key) {
            case 'companies': return `${getCounts().suppliers} suppliers linked`;
            case 'suppliers': return `${getCounts().products} products supplied`;
            case 'products': return summary.low_inventory_alerts > 0
                ? `⚠️ ${summary.low_inventory_alerts} low stock` : '✅ All stocked';
            case 'warehouses': return `${getCounts().products} products stored`;
            case 'shipments': return summary.delayed_shipment_alerts > 0
                ? `🔴 ${summary.delayed_shipment_alerts} delayed` : '✅ All on time';
            default: return '';
        }
    };

    const counts = getCounts();

    const renderDetail = () => {
        if (!activeStage) return null;
        const items = filteredData[activeStage] || [];
        return (
            <div className="pipeline-detail">
                <div className="pipeline-detail-header">
                    <span className="pipeline-detail-title">
                        {stages.find((s) => s.key === activeStage)?.icon} {stages.find((s) => s.key === activeStage)?.label} ({items.length})
                    </span>
                    <button className="pipeline-detail-close" onClick={() => setActiveStage(null)}>✕ Close</button>
                </div>
                <div className="data-cards-grid-wide">
                    {items.map((item, i) => (
                        <div className="data-card" key={i}>
                            {activeStage === 'companies' && (
                                <>
                                    <div className="data-card-top">
                                        <span className="data-card-title">{item.company_name}</span>
                                        <span className="badge badge-info">{item.industry}</span>
                                    </div>
                                    <div className="data-card-meta">📍 {item.country}</div>
                                    <div className="data-card-meta">📧 {item.contact_email}</div>
                                </>
                            )}
                            {activeStage === 'suppliers' && (
                                <>
                                    <div className="data-card-top">
                                        <span className="data-card-title">{item.supplier_name}</span>
                                        <span className="badge badge-info">{item.country}</span>
                                    </div>
                                    <div className="data-card-meta">🏢 {item.company_name || `Company #${item.company_id}`}</div>
                                    <div className="data-card-meta">⏱️ Lead time: {item.lead_time_days}d</div>
                                    <div className="stock-gauge" style={{ marginTop: '6px' }}>
                                        <div className="stock-gauge-bar">
                                            <div className="stock-gauge-fill" style={{
                                                width: `${(item.reliability_score || 0) * 100}%`,
                                                background: item.reliability_score >= 0.8 ? 'var(--safe)' : 'var(--warning)',
                                            }}></div>
                                        </div>
                                        <span className="stock-gauge-text">{((item.reliability_score || 0) * 100).toFixed(0)}%</span>
                                    </div>
                                </>
                            )}
                            {activeStage === 'products' && (
                                <>
                                    <div className="data-card-top">
                                        <span className="data-card-title">{item.product_name}</span>
                                        <span className="badge badge-info">{item.category}</span>
                                    </div>
                                    <div className="data-card-meta">🏢 {item.company_name || `Company #${item.company_id}`}</div>
                                    <div className="data-card-meta">💰 ${item.unit_price}</div>
                                </>
                            )}
                            {activeStage === 'warehouses' && (
                                <>
                                    <div className="data-card-top">
                                        <span className="data-card-title">{item.warehouse_name}</span>
                                    </div>
                                    <div className="data-card-meta">📍 {item.location_city}, {item.location_country}</div>
                                    <div className="data-card-meta">📦 Capacity: {item.capacity_units} units</div>
                                </>
                            )}
                            {activeStage === 'shipments' && (
                                <>
                                    <div className="data-card-top">
                                        <span className="data-card-title">Shipment #{item.shipment_id}</span>
                                        <span className={`badge badge-${item.shipment_status === 'Delivered' ? 'safe' : item.shipment_status === 'Delayed' ? 'danger' : 'info'}`}>
                                            {item.shipment_status}
                                        </span>
                                    </div>
                                    <div className="data-card-meta">📦 {item.product_name || `Product #${item.product_id}`}</div>
                                    <div className="data-card-meta">📅 Expected: {item.expected_delivery_date}</div>
                                    <div className="data-card-meta">📊 Qty: {item.quantity_shipped}</div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="pipeline-header">
                <div className="pipeline-title">🔗 Supply Chain Pipeline</div>
                <div className="pipeline-subtitle">
                    Click a stage to explore the items flowing through your supply chain
                </div>
            </div>

            {/* Flow Diagram */}
            <div className="pipeline-flow">
                {stages.map((stage, i) => {
                    const health = getHealth(stage.key);
                    return (
                        <div className="flow-step" key={stage.key}>
                            {/* Arrow before node (except first) */}
                            {i > 0 && (
                                <div className="flow-arrow">
                                    <div className="flow-arrow-line"></div>
                                    <div className="flow-dot"></div>
                                </div>
                            )}
                            {/* Node */}
                            <div
                                className={`flow-node${activeStage === stage.key ? ' active' : ''}`}
                                onClick={() => setActiveStage(activeStage === stage.key ? null : stage.key)}
                            >
                                <span className="flow-node-icon">{stage.icon}</span>
                                <span className="flow-node-label">{stage.label}</span>
                                <span className="flow-node-count">
                                    {loading ? '...' : counts[stage.key]}
                                </span>
                                <span className="flow-node-stat">{getStat(stage.key)}</span>
                                {/* Health dots */}
                                {!loading && (
                                    <div className="flow-health">
                                        {health.green > 0 && <span className="flow-health-dot green" title={`${health.green} healthy`}></span>}
                                        {health.yellow > 0 && <span className="flow-health-dot yellow" title={`${health.yellow} warning`}></span>}
                                        {health.red > 0 && <span className="flow-health-dot red" title={`${health.red} critical`}></span>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Expanded Detail */}
            {renderDetail()}
        </div>
    );
}
