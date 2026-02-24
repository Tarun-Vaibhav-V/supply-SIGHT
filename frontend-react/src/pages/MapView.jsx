import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { getCompanies, getSuppliers, getRisks, getShipments } from '../api/data';
import '../styles/mapview.css';

export default function MapView() {
    const { user } = useAuth();
    const { filters } = useFilters();
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [supplierMap, setSupplierMap] = useState({});
    const [riskMap, setRiskMap] = useState({});
    const [shipmentMap, setShipmentMap] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [filters.companyId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [compRes, suppRes, riskRes, shipRes] = await Promise.all([
                getCompanies().catch(() => ({ data: [] })),
                getSuppliers().catch(() => ({ data: [] })),
                getRisks().catch(() => ({ data: [] })),
                getShipments().catch(() => ({ data: [] })),
            ]);

            setCompanies(compRes.data);

            // Build per-company maps
            const sMap = {};
            (suppRes.data || []).forEach((s) => {
                if (!sMap[s.company_id]) sMap[s.company_id] = [];
                sMap[s.company_id].push(s);
            });
            setSupplierMap(sMap);

            const rMap = {};
            (riskRes.data || []).forEach((r) => {
                const cid = r.company_id;
                // If risk_event doesn't have company_id, we look it up from entity if possible
                // For simplicity here, we assume company_id exists or we fallback
                const effectiveCid = cid;
                if (!effectiveCid) return;
                if (!rMap[effectiveCid]) rMap[effectiveCid] = { total: 0, open: 0, critical: 0 };
                rMap[effectiveCid].total++;
                if (r.resolution_status === 'Open' || r.resolution_status === 'Investigating') rMap[effectiveCid].open++;
                if (r.risk_severity === 'Critical') rMap[effectiveCid].critical++;
            });
            setRiskMap(rMap);

            const shMap = {};
            (shipRes.data || []).forEach((sh) => {
                const cid = sh.company_id;
                if (!cid) return;
                if (!shMap[cid]) shMap[cid] = { total: 0, delivered: 0, delayed: 0 };
                shMap[cid].total++;
                if (sh.shipment_status === 'Delivered') shMap[cid].delivered++;
                if (sh.shipment_status === 'Delayed') shMap[cid].delayed++;
            });
            setShipmentMap(shMap);
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering
    const filteredCompanies = useMemo(() => {
        return companies.filter(c => {
            if (filters.companyId && c.company_id != filters.companyId) return false;
            if (filters.search && !c.company_name.toLowerCase().includes(filters.search.toLowerCase()) && !c.industry.toLowerCase().includes(filters.search.toLowerCase())) return false;
            return true;
        });
    }, [companies, filters]);

    const getHealth = (company) => {
        const cid = company.company_id;
        const suppliers = supplierMap[cid] || [];
        const risks = riskMap[cid] || { total: 0, open: 0, critical: 0 };
        const shipments = shipmentMap[cid] || { total: 0, delivered: 0, delayed: 0 };

        // Health = weighted average of supplier reliability + shipment on-time - risk penalty
        let avgReliability = 0;
        if (suppliers.length > 0) {
            avgReliability = suppliers.reduce((sum, s) => sum + (s.reliability_score || 0), 0) / suppliers.length;
        }

        let onTimeRate = 1;
        if (shipments.total > 0) {
            onTimeRate = Math.max(0, (shipments.total - shipments.delayed) / shipments.total);
        }

        const riskPenalty = Math.min(0.3, risks.open * 0.05 + risks.critical * 0.1);
        const score = Math.max(0, Math.min(100, ((avgReliability * 0.5 + onTimeRate * 0.5) - riskPenalty) * 100));

        return Math.round(score);
    };

    const getHealthClass = (score) => {
        if (score >= 80) return 'health-good';
        if (score >= 60) return 'health-warning';
        return 'health-critical';
    };

    const getHealthColor = (score) => {
        if (score >= 80) return 'var(--safe)';
        if (score >= 60) return 'var(--warning)';
        return 'var(--danger)';
    };

    return (
        <div className="animate-fade-in">
            <div className="map-header">
                <div className="map-title">🗺️ Company Map</div>
                <div className="map-subtitle">
                    Click a company to explore its full supply chain
                </div>
            </div>

            <div className="company-grid">
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div className="company-card" key={i}>
                            <div className="skeleton" style={{ height: 140 }}></div>
                        </div>
                    ))
                    : filteredCompanies.map((company) => {
                        const cid = company.company_id;
                        const suppliers = supplierMap[cid] || [];
                        const risks = riskMap[cid] || { total: 0, open: 0, critical: 0 };
                        const shipments = shipmentMap[cid] || { total: 0, delivered: 0, delayed: 0 };
                        const health = getHealth(company);
                        const healthClass = getHealthClass(health);

                        return (
                            <div
                                className={`company-card ${healthClass}`}
                                key={cid}
                                onClick={() => navigate(`/company/${cid}`)}
                            >
                                <div className="company-card-header">
                                    <div>
                                        <div className="company-card-name">{company.company_name}</div>
                                        <div className="company-card-industry">{company.industry} • {company.country}</div>
                                    </div>
                                    <div className="company-card-icon">🏢</div>
                                </div>

                                {/* Stats Grid */}
                                <div className="company-card-stats">
                                    <div className="company-stat">
                                        <span className="company-stat-value">{suppliers.length}</span>
                                        <span className="company-stat-label">Suppliers</span>
                                    </div>
                                    <div className="company-stat">
                                        <span className="company-stat-value">{shipments.total}</span>
                                        <span className="company-stat-label">Shipments</span>
                                    </div>
                                    <div className="company-stat">
                                        <span className="company-stat-value">{risks.open}</span>
                                        <span className="company-stat-label">Open Risks</span>
                                    </div>
                                </div>

                                {/* Health Bar */}
                                <div className="company-health-bar">
                                    <div className="company-health-label">
                                        <span className="company-health-text">Supply Chain Health</span>
                                        <span className="company-health-percent" style={{ color: getHealthColor(health) }}>
                                            {health}%
                                        </span>
                                    </div>
                                    <div className="health-track">
                                        <div className="health-fill" style={{
                                            width: `${health}%`,
                                            background: getHealthColor(health),
                                        }}></div>
                                    </div>
                                </div>

                                {/* Risk Badges */}
                                {(risks.critical > 0 || risks.open > 0 || shipments.delayed > 0) && (
                                    <div className="company-risks">
                                        {risks.critical > 0 && (
                                            <span className="badge badge-danger">{risks.critical} critical</span>
                                        )}
                                        {shipments.delayed > 0 && (
                                            <span className="badge badge-warning">{shipments.delayed} delayed</span>
                                        )}
                                    </div>
                                )}

                                {/* CTA */}
                                <div className="company-card-cta">
                                    View Details →
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}
