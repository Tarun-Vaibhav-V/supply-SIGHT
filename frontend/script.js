/**
 * SupplySight v2 — Dashboard Logic
 * Charts · CRUD Operations · Search · Filters · Toast Notifications
 */

const API = '';

// ── Chart.js Theme ──────────────────────────────────────────────
Chart.defaults.color = '#888';
Chart.defaults.borderColor = 'rgba(255,255,255,0.04)';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;

let chartInv, chartDel, chartRel, chartSev;
let cachedLowInv = [], cachedDelayed = [], cachedOrders = [];
let cachedSuppliers = [], cachedRisks = [];

// ── Helpers ─────────────────────────────────────────────────────
const fmt = d => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

function pill(status) {
    const m = {
        'In Stock': 'safe', 'Active': 'safe', 'Delivered': 'safe', 'Resolved': 'safe', 'Fulfilled': 'safe',
        'Low Stock': 'warning', 'Pending': 'warning', 'Investigating': 'warning',
        'In Transit': 'info', 'Processing': 'info', 'Shipped': 'info',
        'Out of Stock': 'critical', 'Delayed': 'critical', 'Critical': 'critical', 'Open': 'critical', 'Cancelled': 'critical',
        'High': 'warning', 'Medium': 'info', 'Low': 'muted',
        'Dismissed': 'muted', 'Inactive': 'muted',
    };
    return `<span class="pill ${m[status] || 'muted'}">${status || '—'}</span>`;
}

function prio(p) {
    const m = { Critical: 'critical', High: 'warning', Medium: 'info', Low: 'muted', Urgent: 'critical' };
    return `<span class="pill ${m[p] || 'muted'}">${p || '—'}</span>`;
}

function progress(cur, thr) {
    const pct = thr > 0 ? Math.min(100, Math.round((cur / thr) * 100)) : 0;
    const c = pct >= 70 ? 'var(--safe)' : pct >= 40 ? 'var(--warning)' : 'var(--critical)';
    return `<div class="progress-wrap">
        <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${c}"></div></div>
        <span class="progress-text" style="color:${c}">${cur}/${thr}</span>
    </div>`;
}

function relBar(score) {
    const pct = Math.round((score || 0) * 100);
    const c = pct >= 90 ? 'var(--safe)' : pct >= 75 ? 'var(--warning)' : 'var(--critical)';
    return `<div class="reliability-bar">
        <div class="reliability-track"><div class="reliability-fill" style="width:${pct}%;background:${c}"></div></div>
        <span class="reliability-text" style="color:${c}">${pct}%</span>
    </div>`;
}

async function api(path, opts = {}) {
    const r = await fetch(API + path, opts);
    const json = await r.json();
    if (!r.ok) throw new Error(json.detail || `HTTP ${r.status}`);
    return json;
}

function tick() {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Toast Notification ──────────────────────────────────────────
function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Insight Banner ──────────────────────────────────────────────
function setInsight(s) {
    const b = document.getElementById('insightBanner');
    if (!b) return;
    const d = s.delayed_shipment_alerts || 0;
    const l = s.low_inventory_alerts || 0;
    const r = s.open_risks || 0;
    if (d > 5 && l > 5)
        b.textContent = `🚨 Critical — ${d} delayed shipments & ${l} low stock items need review`;
    else if (d > 3)
        b.textContent = `🚨 ${d} shipment delays detected — review supplier performance`;
    else if (l > 3)
        b.textContent = `⚠️ ${l} items below minimum stock — reorder recommended`;
    else if (r > 3)
        b.textContent = `🛡️ ${r} open risk events need attention`;
    else
        b.textContent = '✅ Supply chain operating normally — all systems green';
}

// ── Animated Counter ────────────────────────────────────────────
function animNum(el, to) {
    const dur = 500, t0 = performance.now();
    (function step(t) {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
    })(t0);
}

function setTrend(id, val, thr) {
    const el = document.getElementById(id);
    if (!el) return;
    if (val > thr) { el.className = 'kpi-trend up'; el.textContent = `↑ ${val} active`; }
    else if (val === 0) { el.className = 'kpi-trend neutral'; el.textContent = '— clear'; }
    else { el.className = 'kpi-trend down'; el.textContent = `↓ ${val} only`; }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA LOADERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadSummary() {
    try {
        const d = await api('/api/dashboard/summary');
        const map = {
            'val-companies': d.total_companies, 'val-suppliers': d.total_suppliers,
            'val-products': d.total_products, 'val-warehouses': d.total_warehouses,
            'val-low-inventory': d.low_inventory_alerts, 'val-delayed': d.delayed_shipment_alerts,
            'val-orders': d.total_orders, 'val-risks': d.open_risks,
        };
        for (const [id, v] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) animNum(el, v);
        }
        setTrend('trend-low-inv', d.low_inventory_alerts, 3);
        setTrend('trend-delayed', d.delayed_shipment_alerts, 3);
        setTrend('trend-risks', d.open_risks, 3);
        setInsight(d);
    } catch (e) { console.error('loadSummary:', e); }
}

// ── Low Inventory ───────────────────────────────────────────────
async function loadLowInv() {
    try {
        const d = await api('/api/risks/low-inventory');
        cachedLowInv = d || [];
        renderLowInv(cachedLowInv);
    } catch (e) { console.error('loadLowInv:', e); }
}

function renderLowInv(data) {
    const tb = document.getElementById('tbody-low-inv');
    const badge = document.getElementById('badge-low-inv');
    const empty = document.getElementById('empty-low-inv');
    if (!tb) return;
    badge.textContent = data.length;
    if (!data.length) { tb.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    tb.innerHTML = data.map(r => `<tr class="fade-in">
        <td><span class="cell-primary">${r.product_name}</span><div class="cell-sub">${r.category || ''}</div></td>
        <td>${r.warehouse_name}</td>
        <td>${progress(r.quantity_available, r.minimum_threshold)}</td>
        <td>${pill(r.inventory_status)}</td>
    </tr>`).join('');
}

// ── Delayed Shipments ───────────────────────────────────────────
async function loadDelayed() {
    try {
        const d = await api('/api/risks/delayed-shipments');
        cachedDelayed = d || [];
        renderDelayed(cachedDelayed);
    } catch (e) { console.error('loadDelayed:', e); }
}

function renderDelayed(data) {
    const tb = document.getElementById('tbody-delayed');
    const badge = document.getElementById('badge-delayed');
    const empty = document.getElementById('empty-delayed');
    if (!tb) return;
    badge.textContent = data.length;
    if (!data.length) { tb.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    tb.innerHTML = data.map(r => `<tr class="fade-in">
        <td class="cell-id">#${r.shipment_id}</td>
        <td class="cell-primary">${r.product_name}</td>
        <td>${r.supplier_name}</td>
        <td>${fmt(r.expected_delivery_date)}</td>
        <td class="cell-danger">${r.days_overdue}d late</td>
    </tr>`).join('');
}

// ── Orders ──────────────────────────────────────────────────────
async function loadOrders() {
    try {
        const d = await api('/api/orders');
        cachedOrders = d || [];
        renderOrders(cachedOrders);
    } catch (e) { console.error('loadOrders:', e); }
}

function renderOrders(data) {
    const tb = document.getElementById('tbody-orders');
    const badge = document.getElementById('badge-orders');
    if (!tb) return;
    badge.textContent = data.length;
    tb.innerHTML = data.map(r => `<tr class="fade-in">
        <td class="cell-id">#${r.order_id}</td>
        <td>${r.company_name}</td>
        <td class="cell-primary">${r.product_name}</td>
        <td>${(r.order_quantity || 0).toLocaleString()}</td>
        <td>${fmt(r.order_date)}</td>
        <td>${fmt(r.expected_fulfill_date)}</td>
        <td>${pill(r.order_status)}</td>
        <td>${prio(r.priority_level)}</td>
    </tr>`).join('');
}

// ── Supplier Reliability ────────────────────────────────────────
async function loadSuppliers() {
    try {
        const d = await api('/api/suppliers/reliability');
        cachedSuppliers = d || [];
        renderSuppliers(cachedSuppliers);
        fillFilter('filter-supplier', d, 'supplier_name');
    } catch (e) { console.error('loadSuppliers:', e); }
}

function renderSuppliers(data) {
    const tb = document.getElementById('tbody-suppliers');
    if (!tb) return;
    tb.innerHTML = data.map(r => `<tr class="fade-in">
        <td class="cell-primary">${r.supplier_name}</td>
        <td>${r.company_name}</td>
        <td>${r.country}</td>
        <td>${relBar(r.reliability_score)}</td>
        <td>${r.lead_time_days}d</td>
        <td>${r.total_shipments}</td>
        <td style="color:var(--safe);font-weight:700">${r.delivered}</td>
        <td style="color:${(r.delayed || 0) > 0 ? 'var(--critical)' : 'var(--text-3)'};font-weight:700">${r.delayed || 0}</td>
        <td>${r.active_status ? pill('Active') : pill('Inactive')}</td>
    </tr>`).join('');
}

// ── Risk Events (with action buttons) ───────────────────────────
async function loadRisks() {
    try {
        const d = await api('/api/risks');
        cachedRisks = d || [];
        renderRisks(cachedRisks);
    } catch (e) { console.error('loadRisks:', e); }
}

function renderRisks(data) {
    const tb = document.getElementById('tbody-risks');
    const badge = document.getElementById('badge-risks');
    if (!tb) return;
    badge.textContent = data.length;
    tb.innerHTML = data.map(r => {
        const isOpen = r.resolution_status === 'Open' || r.resolution_status === 'Investigating';
        return `<tr class="fade-in">
            <td class="cell-id">#${r.risk_id}</td>
            <td>${r.entity_type || ''} #${r.entity_id || ''}</td>
            <td class="cell-primary">${r.risk_type || ''}</td>
            <td>${pill(r.risk_severity)}</td>
            <td>${fmt(r.detected_date)}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r.description || '').replace(/"/g, '&quot;')}">${r.description || '—'}</td>
            <td>${pill(r.resolution_status)}</td>
            <td class="action-btns">
                ${isOpen ? `<button class="btn btn-safe btn-sm" onclick="resolveRisk(${r.risk_id})">✅ Resolve</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="dismissRisk(${r.risk_id})">🗑️</button>
            </td>
        </tr>`;
    }).join('');
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRUD ACTIONS (POST / PUT / DELETE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Resolve Risk ────────────────────────────────────────────────
async function resolveRisk(id) {
    try {
        const res = await api(`/api/risks/${id}/resolve`, { method: 'PUT' });
        toast(res.message, 'success');
        await refreshAll();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ── Dismiss Risk ────────────────────────────────────────────────
async function dismissRisk(id) {
    try {
        const res = await api(`/api/risks/${id}`, { method: 'DELETE' });
        toast(res.message, 'success');
        await refreshAll();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ── Scan for Risks ──────────────────────────────────────────────
async function scanForRisks() {
    try {
        toast('🔍 Scanning for risks...', 'info');
        const res = await api('/api/risks/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        toast(res.message, res.new_risks_created > 0 ? 'success' : 'info');
        await refreshAll();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// ── New Order Form ──────────────────────────────────────────────
function toggleOrderForm() {
    const form = document.getElementById('orderForm');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? '' : 'none';
}

async function loadDropdowns() {
    try {
        const [companies, products] = await Promise.all([
            api('/api/dropdown/companies'),
            api('/api/dropdown/products'),
        ]);
        const cSel = document.getElementById('order-company');
        const pSel = document.getElementById('order-product');
        if (cSel) {
            cSel.innerHTML = companies.map(c =>
                `<option value="${c.company_id}">${c.company_name}</option>`
            ).join('');
        }
        if (pSel) {
            pSel.innerHTML = products.map(p =>
                `<option value="${p.product_id}">${p.product_name} (${p.supplier_name})</option>`
            ).join('');
        }
    } catch (e) { console.error('loadDropdowns:', e); }
}

async function submitOrder() {
    const status = document.getElementById('order-status');
    const company = document.getElementById('order-company')?.value;
    const product = document.getElementById('order-product')?.value;
    const qty = document.getElementById('order-qty')?.value;
    const priority = document.getElementById('order-priority')?.value;

    if (!company || !product || !qty || qty < 1) {
        if (status) { status.textContent = 'Please fill all fields'; status.className = 'form-status error'; }
        return;
    }

    try {
        if (status) { status.textContent = 'Processing...'; status.className = 'form-status'; }
        const res = await api('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                company_id: parseInt(company),
                product_id: parseInt(product),
                quantity: parseInt(qty),
                priority: priority,
            }),
        });
        toast(`✅ ${res.message}`, 'success');
        if (status) { status.textContent = res.message; status.className = 'form-status success'; }
        toggleOrderForm();
        await refreshAll();
    } catch (e) {
        const msg = e.message || 'Failed to place order';
        toast(`❌ ${msg}`, 'error');
        if (status) { status.textContent = msg; status.className = 'form-status error'; }
    }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHARTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadChartInv() {
    try {
        const d = await api('/api/risks/low-inventory');
        if (!d || !d.length) return;
        const ctx = document.getElementById('chart-inventory');
        if (!ctx) return;
        if (chartInv) chartInv.destroy();
        chartInv = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: d.map(r => r.product_name.length > 18 ? r.product_name.slice(0, 18) + '…' : r.product_name),
                datasets: [{
                    label: 'Available', data: d.map(r => r.quantity_available),
                    backgroundColor: d.map(r => {
                        const p = r.quantity_available / r.minimum_threshold;
                        return p >= 0.7 ? 'rgba(52,211,153,0.65)' : p >= 0.4 ? 'rgba(251,191,36,0.65)' : 'rgba(239,68,68,0.65)';
                    }),
                    borderRadius: 4, barThickness: 18,
                }, {
                    label: 'Threshold', data: d.map(r => r.minimum_threshold),
                    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, barThickness: 18,
                }]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } },
                scales: { x: { grid: { color: 'rgba(255,255,255,0.03)' } }, y: { grid: { display: false } } }
            }
        });
    } catch (e) { console.error('chartInv:', e); }
}

async function loadChartDel() {
    try {
        const d = await api('/api/risks/delayed-shipments');
        if (!d || !d.length) return;
        const ctx = document.getElementById('chart-delays');
        if (!ctx) return;
        if (chartDel) chartDel.destroy();
        chartDel = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: d.map(r => r.product_name.length > 14 ? r.product_name.slice(0, 14) + '…' : r.product_name),
                datasets: [{
                    label: 'Days Overdue', data: d.map(r => r.days_overdue),
                    backgroundColor: d.map(r => r.days_overdue >= 10 ? 'rgba(239,68,68,0.7)' : r.days_overdue >= 5 ? 'rgba(251,191,36,0.7)' : 'rgba(96,165,250,0.7)'),
                    borderRadius: 6, barThickness: 28,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Days', color: '#555', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (e) { console.error('chartDel:', e); }
}

async function loadChartRel() {
    try {
        const d = await api('/api/suppliers/reliability');
        if (!d) return;
        const ctx = document.getElementById('chart-reliability');
        if (!ctx) return;
        if (chartRel) chartRel.destroy();
        const scores = d.map(r => Math.round((r.reliability_score || 0) * 100));
        chartRel = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: d.map(r => r.supplier_name.length > 14 ? r.supplier_name.slice(0, 14) + '…' : r.supplier_name),
                datasets: [{
                    label: 'Reliability %', data: scores,
                    backgroundColor: scores.map(s => s >= 90 ? 'rgba(52,211,153,0.65)' : s >= 75 ? 'rgba(245,197,24,0.65)' : 'rgba(239,68,68,0.65)'),
                    borderRadius: 6, barThickness: 28,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 100, title: { display: true, text: '%', color: '#555', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (e) { console.error('chartRel:', e); }
}

async function loadChartSev() {
    try {
        const d = await api('/api/risks');
        if (!d) return;
        const ctx = document.getElementById('chart-risk-severity');
        if (!ctx) return;
        if (chartSev) chartSev.destroy();
        const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        d.forEach(r => { if (r.risk_severity in counts) counts[r.risk_severity]++; });
        chartSev = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(counts),
                datasets: [{
                    data: Object.values(counts),
                    backgroundColor: ['rgba(239,68,68,0.8)', 'rgba(251,146,60,0.8)', 'rgba(96,165,250,0.8)', 'rgba(80,80,80,0.5)'],
                    borderWidth: 0, hoverOffset: 8,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, color: '#888', font: { size: 11 } } } }
            }
        });
    } catch (e) { console.error('chartSev:', e); }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILTERS + SEARCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fillFilter(id, data, key) {
    const sel = document.getElementById(id);
    if (!sel || !data) return;
    const existing = new Set([...sel.options].map(o => o.value));
    const vals = [...new Set(data.map(r => r[key]).filter(Boolean))].sort();
    vals.forEach(v => {
        if (!existing.has(v)) {
            const o = document.createElement('option');
            o.value = v; o.textContent = v; sel.appendChild(o);
        }
    });
}

function applyFilters() {
    const wh = document.getElementById('filter-warehouse')?.value || '';
    const su = document.getElementById('filter-supplier')?.value || '';
    const sv = document.getElementById('filter-severity')?.value || '';

    renderLowInv(wh ? cachedLowInv.filter(r => r.warehouse_name === wh) : cachedLowInv);
    renderDelayed(su ? cachedDelayed.filter(r => r.supplier_name === su) : cachedDelayed);
    renderRisks(sv ? cachedRisks.filter(r => r.risk_severity === sv) : cachedRisks);
    renderSuppliers(su ? cachedSuppliers.filter(r => r.supplier_name === su) : cachedSuppliers);
}

function initSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;
    input.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('tbody tr:not(.skeleton-row)').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REFRESH & INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function refreshAll() {
    await Promise.allSettled([
        loadSummary(),
        loadLowInv(),
        loadDelayed(),
        loadOrders(),
        loadSuppliers(),
        loadRisks(),
        loadChartInv(),
        loadChartDel(),
        loadChartRel(),
        loadChartSev(),
    ]);
}

async function init() {
    console.log('SupplySight v2 — init');
    tick();
    setInterval(tick, 1000);
    initSearch();

    ['filter-warehouse', 'filter-supplier', 'filter-severity'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFilters);
    });

    // Load everything
    await loadSummary();

    await Promise.allSettled([
        loadLowInv(),
        loadDelayed(),
        loadOrders(),
        loadSuppliers(),
        loadRisks(),
        loadChartInv(),
        loadChartDel(),
        loadChartRel(),
        loadChartSev(),
        loadDropdowns(),
    ]);

    if (cachedLowInv.length) fillFilter('filter-warehouse', cachedLowInv, 'warehouse_name');
    console.log('SupplySight v2 — ready');
}

document.addEventListener('DOMContentLoaded', init);
