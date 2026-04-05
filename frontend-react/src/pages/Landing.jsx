import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

/* ─── Scroll-reveal hook ────────────────────────────────────── */
function useReveal() {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) el.classList.add('visible'); },
            { threshold: 0.15 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

/* ─── Animated Counter ──────────────────────────────────────── */
function AnimatedStat({ value, label, suffix = '' }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let started = false;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started) {
                started = true;
                animateCount(el, value, suffix);
            }
        }, { threshold: 0.5 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [value, suffix]);

    return (
        <div className="stat-item">
            <span className="stat-number" ref={ref}>0{suffix}</span>
            <span className="stat-label">{label}</span>
        </div>
    );
}

function animateCount(el, target, suffix) {
    const duration = 1600;
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

/* ─── Feature data ──────────────────────────────────────────── */
const features = [
    {
        icon: '📊',
        title: 'Real-Time KPI Dashboard',
        desc: 'Monitor companies, suppliers, shipments & inventory at a glance with auto-refreshing metrics and interactive charts.',
    },
    {
        icon: '⚠️',
        title: 'Automated Risk Detection',
        desc: 'SQL-powered triggers automatically flag delayed shipments, low inventory, and unreliable suppliers the moment they occur.',
    },
    {
        icon: '🗺️',
        title: 'Global Supply Map',
        desc: 'Visualize your entire supply chain on an interactive map — see warehouse locations, supplier routes, and shipment flows.',
    },
    {
        icon: '🔗',
        title: 'Pipeline Tracking',
        desc: 'Track every order from placement through processing, shipping and delivery with real-time status updates.',
    },
    {
        icon: '🤖',
        title: 'AI-Powered Insights',
        desc: 'Intelligent chat assistant analyzes your data and surfaces actionable recommendations to optimize operations.',
    },
    {
        icon: '🔒',
        title: 'Secure & Scalable',
        desc: 'JWT authentication, Google OAuth, role-based access, and a fully normalized PostgreSQL backend built for growth.',
    },
];

const steps = [
    {
        title: 'Connect Your Data',
        desc: 'Register your company, add suppliers and products. Our system automatically builds the relational graph.',
    },
    {
        title: 'Monitor & Detect',
        desc: 'The dashboard ingests live data, runs risk queries, and flags anomalies — delayed shipments, stock gaps, and more.',
    },
    {
        title: 'Act & Resolve',
        desc: 'Drill into risks, update statuses, place orders, and track resolutions — all from a single pane of glass.',
    },
];

/* ─── Landing Page Component ────────────────────────────────── */
export default function Landing() {
    const featuresRef = useReveal();
    const stepsRef = useReveal();
    const ctaRef = useReveal();

    /* Navbar scroll effect */
    useEffect(() => {
        const nav = document.querySelector('.landing-nav');
        if (!nav) return;
        const handler = () => nav.classList.toggle('scrolled', window.scrollY > 40);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    return (
        <div className="landing">
            {/* ── Navigation ─────────────────────────────────── */}
            <nav className="landing-nav" id="landing-nav">
                <Link to="/" className="nav-logo">
                    <span className="nav-logo-icon">⚡</span>
                    <span className="nav-logo-text">SupplySight</span>
                </Link>
                <div className="nav-links">
                    <a href="#features" className="nav-link">Features</a>
                    <a href="#how-it-works" className="nav-link">How It Works</a>
                    <Link to="/login" className="nav-link">Sign In</Link>
                    <Link to="/register" className="nav-cta">Get Started</Link>
                </div>
            </nav>

            {/* ── Hero ───────────────────────────────────────── */}
            <section className="hero" id="hero">
                <div className="hero-bg">
                    <div className="hero-grid"></div>
                    <div className="orb orb-1"></div>
                    <div className="orb orb-2"></div>
                    <div className="orb orb-3"></div>
                </div>

                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="hero-badge-dot"></span>
                        Supply Chain Intelligence Platform
                    </div>

                    <h1>
                        Your Supply Chain,<br />
                        <span className="gold">Under Control.</span>
                    </h1>

                    <p className="hero-description">
                        Monitor suppliers, detect risks in real-time, and make data-driven decisions —
                        all from a single premium dashboard powered by PostgreSQL and FastAPI.
                    </p>

                    <div className="hero-actions">
                        <Link to="/register" className="hero-btn-primary" id="hero-get-started">
                            Get Started Free
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                            </svg>
                        </Link>
                        <Link to="/login" className="hero-btn-secondary" id="hero-sign-in">
                            Sign In
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Stats Ticker ────────────────────────────────── */}
            <div className="stats-bar">
                <AnimatedStat value={8} label="Database Tables" />
                <AnimatedStat value={12} label="API Endpoints" suffix="+" />
                <AnimatedStat value={99} label="Uptime" suffix="%" />
                <AnimatedStat value={3} label="Risk Engines" />
            </div>

            {/* ── Features ────────────────────────────────────── */}
            <section className="landing-section reveal" ref={featuresRef} id="features">
                <div className="section-label">✦ Core Capabilities</div>
                <h2 className="section-title">
                    Everything you need to <span className="gold">protect your supply chain</span>
                </h2>
                <p className="section-subtitle">
                    From real-time monitoring to automated risk alerts — SupplySight gives you full visibility and control.
                </p>

                <div className="features-grid">
                    {features.map((f, i) => (
                        <div className="feature-card" key={i}>
                            <div className="feature-icon">{f.icon}</div>
                            <div className="feature-title">{f.title}</div>
                            <div className="feature-desc">{f.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ────────────────────────────────── */}
            <section className="landing-section reveal" ref={stepsRef} id="how-it-works">
                <div className="section-label">⚙ How It Works</div>
                <h2 className="section-title">
                    Three steps to <span className="gold">total visibility</span>
                </h2>
                <p className="section-subtitle">
                    Get up and running in minutes — no complex integrations required.
                </p>

                <div className="steps-grid">
                    {steps.map((s, i) => (
                        <div className="step-card" key={i}>
                            <div className="step-title">{s.title}</div>
                            <div className="step-desc">{s.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ─────────────────────────────────────────── */}
            <section className="cta-section reveal" ref={ctaRef}>
                <div className="cta-box">
                    <h2 className="cta-title">
                        Ready to secure your <span className="gold">supply chain</span>?
                    </h2>
                    <p className="cta-desc">
                        Join teams using SupplySight to detect risks before they become disruptions.
                    </p>
                    <Link to="/register" className="hero-btn-primary" id="cta-get-started">
                        Start Monitoring Now
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────── */}
            <footer className="landing-footer">
                <span>© 2026 SupplySight — SEM-4 Web Programming + DBMS</span>
                <div className="footer-links">
                    <a href="#features">Features</a>
                    <a href="#how-it-works">How It Works</a>
                    <Link to="/login">Sign In</Link>
                </div>
            </footer>
        </div>
    );
}
