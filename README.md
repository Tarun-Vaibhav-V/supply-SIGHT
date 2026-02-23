# 🚀 SupplySight — Supply Chain Monitoring System

A full-stack web application that manages structured supply chain data and **detects risks** (delayed shipments, low inventory) using SQL queries. Built with **PostgreSQL**, **FastAPI (Python)**, and a **dark-themed HTML/JS dashboard**.

---

## 📁 Project Structure

```
webpDBMS/
├── backend/                  # Python FastAPI backend
│   ├── __init__.py
│   ├── database.py           # PostgreSQL connection, session factory, DB init
│   ├── models.py             # SQLAlchemy ORM models (8 tables)
│   └── main.py               # FastAPI app with 12+ REST API endpoints
│
├── database/                 # Raw SQL files
│   ├── schema.sql            # DDL — CREATE TABLE statements with constraints
│   ├── seed_data.sql         # Sample data (companies, suppliers, products, etc.)
│   └── advanced_features.sql # Views, Triggers, Stored Functions, Indexes
│
├── frontend/                 # Static web dashboard
│   ├── index.html            # Dashboard layout with KPI cards & tables
│   ├── style.css             # Dark theme, glassmorphism, animations
│   └── script.js             # Fetches API data, renders tables dynamically
│
├── requirements.txt          # Python dependencies
├── .env.example              # Environment config template
└── README.md                 # This file
```

---

## 🧱 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | PostgreSQL 17 | Relational data storage, SQL risk queries |
| **ORM** | SQLAlchemy 2.0 | Python ↔ PostgreSQL mapping |
| **Backend** | FastAPI + Uvicorn | REST API server |
| **Frontend** | HTML + CSS + JavaScript | Dashboard UI (no framework) |
| **Charts** | Chart.js 4.4 | Interactive data visualizations (bar, doughnut) |
| **Driver** | psycopg2-binary | PostgreSQL adapter for Python |

---

## 🗄 Database Design (ER Model → 3NF)

The database is derived from an **ER diagram** and normalized to **Third Normal Form (3NF)**.

### Entity-Relationship Diagram

```mermaid
erDiagram
    COMPANY ||--o{ SUPPLIER : "has"
    COMPANY ||--o{ ORDERS : "places"
    SUPPLIER ||--o{ PRODUCT : "provides"
    SUPPLIER ||--o{ SHIPMENT : "sends"
    PRODUCT ||--o{ SHIPMENT : "shipped in"
    PRODUCT ||--o{ ORDERS : "ordered"
    PRODUCT ||--o{ INVENTORY : "stored"
    WAREHOUSE ||--o{ INVENTORY : "holds"
    RISK_EVENT }o--|| COMPANY : "linked to"
```

### Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| COMPANY → SUPPLIER | 1:N | One company has many suppliers |
| SUPPLIER → PRODUCT | 1:N | One supplier provides many products |
| PRODUCT ↔ WAREHOUSE | M:N | Resolved via INVENTORY (associative table) |
| SUPPLIER → SHIPMENT | 1:N | One supplier sends many shipments |
| PRODUCT → SHIPMENT | 1:N | One product appears in many shipments |
| COMPANY → ORDERS | 1:N | One company places many orders |
| PRODUCT → ORDERS | 1:N | One product can be in many orders |
| ENTITY → RISK_EVENT | 1:N | Risks linked to any entity by type+ID |

---

## 📘 Table Schemas (8 Tables)

### 1. COMPANY (Master Entity)
Stores organizations using the system.

```sql
CREATE TABLE company (
    company_id     SERIAL PRIMARY KEY,
    company_name   VARCHAR(150) NOT NULL,
    industry       VARCHAR(100),
    country        VARCHAR(100),
    contact_email  VARCHAR(150),
    contact_phone  VARCHAR(30),
    created_at     DATE DEFAULT CURRENT_DATE,
    status         VARCHAR(30) DEFAULT 'Active'
                   CHECK (status IN ('Active', 'Inactive', 'Suspended'))
);
```

### 2. SUPPLIER
Suppliers belonging to companies.

```sql
CREATE TABLE supplier (
    supplier_id      SERIAL PRIMARY KEY,
    supplier_name    VARCHAR(150) NOT NULL,
    company_id       INT NOT NULL,
    country          VARCHAR(100),
    lead_time_days   INT CHECK (lead_time_days >= 0),
    reliability_score DECIMAL(3,2) CHECK (reliability_score BETWEEN 0 AND 1),
    contact_email    VARCHAR(150),
    active_status    BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
);
```

### 3. PRODUCT
Products provided by suppliers.

```sql
CREATE TABLE product (
    product_id    SERIAL PRIMARY KEY,
    product_name  VARCHAR(200) NOT NULL,
    supplier_id   INT NOT NULL,
    category      VARCHAR(100),
    unit_price    DECIMAL(12,2) CHECK (unit_price >= 0),
    reorder_level INT DEFAULT 10 CHECK (reorder_level >= 0),
    weight_kg     DECIMAL(8,2),
    active_status BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id) ON DELETE CASCADE
);
```

### 4. WAREHOUSE
Storage locations.

```sql
CREATE TABLE warehouse (
    warehouse_id     SERIAL PRIMARY KEY,
    warehouse_name   VARCHAR(150) NOT NULL,
    location_city    VARCHAR(100),
    location_country VARCHAR(100),
    capacity_units   INT CHECK (capacity_units > 0),
    manager_name     VARCHAR(100),
    contact_number   VARCHAR(30),
    active_status    BOOLEAN DEFAULT TRUE
);
```

### 5. INVENTORY (Associative Table — Resolves Product ↔ Warehouse M:N)

```sql
CREATE TABLE inventory (
    inventory_id      SERIAL PRIMARY KEY,
    product_id        INT NOT NULL,
    warehouse_id      INT NOT NULL,
    quantity_available INT DEFAULT 0 CHECK (quantity_available >= 0),
    reserved_quantity  INT DEFAULT 0 CHECK (reserved_quantity >= 0),
    last_updated      DATE DEFAULT CURRENT_DATE,
    minimum_threshold INT DEFAULT 10 CHECK (minimum_threshold >= 0),
    inventory_status  VARCHAR(30) DEFAULT 'In Stock'
                      CHECK (inventory_status IN ('In Stock', 'Low Stock', 'Out of Stock')),
    FOREIGN KEY (product_id)   REFERENCES product(product_id)     ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id) ON DELETE CASCADE
);
```

### 6. SHIPMENT
Tracks product movement from suppliers.

```sql
CREATE TABLE shipment (
    shipment_id            SERIAL PRIMARY KEY,
    product_id             INT NOT NULL,
    supplier_id            INT NOT NULL,
    quantity_shipped        INT CHECK (quantity_shipped > 0),
    expected_delivery_date DATE NOT NULL,
    actual_delivery_date   DATE,
    shipment_status        VARCHAR(30) DEFAULT 'In Transit'
                           CHECK (shipment_status IN ('In Transit', 'Delivered', 'Delayed', 'Cancelled')),
    transport_mode         VARCHAR(30) CHECK (transport_mode IN ('Air', 'Sea', 'Road', 'Rail')),
    FOREIGN KEY (product_id) REFERENCES product(product_id)   ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id) ON DELETE CASCADE
);
```

### 7. ORDERS
Tracks product demand from companies.

```sql
CREATE TABLE orders (
    order_id             SERIAL PRIMARY KEY,
    company_id           INT NOT NULL,
    product_id           INT NOT NULL,
    order_quantity       INT CHECK (order_quantity > 0),
    order_date           DATE DEFAULT CURRENT_DATE,
    expected_fulfill_date DATE,
    order_status         VARCHAR(30) DEFAULT 'Pending'
                         CHECK (order_status IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
    priority_level       VARCHAR(20) DEFAULT 'Medium'
                         CHECK (priority_level IN ('Low', 'Medium', 'High', 'Critical')),
    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE
);
```

### 8. RISK_EVENT
Stores detected supply chain risks.

```sql
CREATE TABLE risk_event (
    risk_id           SERIAL PRIMARY KEY,
    entity_type       VARCHAR(50) NOT NULL
                      CHECK (entity_type IN ('Supplier', 'Product', 'Shipment', 'Inventory', 'Warehouse', 'Order')),
    entity_id         INT NOT NULL,
    risk_type         VARCHAR(50) NOT NULL,
    risk_severity     VARCHAR(20) DEFAULT 'Medium'
                      CHECK (risk_severity IN ('Low', 'Medium', 'High', 'Critical')),
    detected_date     DATE DEFAULT CURRENT_DATE,
    description       TEXT,
    resolution_status VARCHAR(30) DEFAULT 'Open'
                      CHECK (resolution_status IN ('Open', 'Investigating', 'Resolved', 'Dismissed'))
);
```

---

## 🔑 Key SQL Concepts Used

| Concept | Where Used |
|---------|-----------|
| **Primary Keys** | Every table has `SERIAL PRIMARY KEY` |
| **Foreign Keys** | `supplier.company_id → company`, `product.supplier_id → supplier`, etc. |
| **ON DELETE CASCADE** | Deleting a parent auto-deletes children |
| **CHECK constraints** | Status enums, score ranges, positive quantities |
| **DEFAULT values** | `CURRENT_DATE`, `'Active'`, `TRUE`, `0` |
| **Associative table** | `inventory` resolves Product ↔ Warehouse M:N relationship |
| **SERIAL** | Auto-incrementing integer PKs (PostgreSQL) |
| **JOIN queries** | Used in all API endpoints to fetch related data |
| **Aggregate functions** | `COUNT()`, `SUM()`, `CASE WHEN` in supplier reliability |
| **Date arithmetic** | `CURRENT_DATE - expected_delivery_date` for overdue days |

---

## 🔍 Risk Detection Queries

### 1. Low Inventory Detection

Finds products where current stock is **below the minimum threshold**:

```sql
SELECT i.inventory_id, p.product_name, p.category, s.supplier_name,
       w.warehouse_name, i.quantity_available, i.minimum_threshold,
       i.inventory_status, i.last_updated
FROM inventory i
JOIN product p ON i.product_id = p.product_id
JOIN supplier s ON p.supplier_id = s.supplier_id
JOIN warehouse w ON i.warehouse_id = w.warehouse_id
WHERE i.quantity_available < i.minimum_threshold
ORDER BY (i.minimum_threshold - i.quantity_available) DESC;
```

**How it works:**
- JOINs 4 tables to get full product/supplier/warehouse info
- `WHERE quantity_available < minimum_threshold` is the risk condition
- Ordered by severity (biggest gap first)

### 2. Delayed Shipment Detection

Finds shipments that are **past their expected delivery date** but haven't arrived:

```sql
SELECT sh.shipment_id, p.product_name, s.supplier_name,
       sh.quantity_shipped, sh.expected_delivery_date,
       sh.shipment_status, sh.transport_mode,
       (CURRENT_DATE - sh.expected_delivery_date) AS days_overdue
FROM shipment sh
JOIN product p ON sh.product_id = p.product_id
JOIN supplier s ON sh.supplier_id = s.supplier_id
WHERE sh.actual_delivery_date IS NULL
  AND sh.expected_delivery_date < CURRENT_DATE
ORDER BY sh.expected_delivery_date ASC;
```

**How it works:**
- `actual_delivery_date IS NULL` → shipment hasn't arrived yet
- `expected_delivery_date < CURRENT_DATE` → it's past due
- Calculates `days_overdue` using date subtraction
- Oldest overdue shipments appear first

### 3. Supplier Reliability Analysis

```sql
SELECT s.supplier_id, s.supplier_name, s.country, s.reliability_score,
       s.lead_time_days, s.active_status, c.company_name,
       COUNT(sh.shipment_id) AS total_shipments,
       SUM(CASE WHEN sh.shipment_status = 'Delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN sh.shipment_status = 'Delayed' THEN 1 ELSE 0 END) AS delayed
FROM supplier s
JOIN company c ON s.company_id = c.company_id
LEFT JOIN shipment sh ON s.supplier_id = sh.supplier_id
GROUP BY s.supplier_id, s.supplier_name, s.country, s.reliability_score,
         s.lead_time_days, s.active_status, c.company_name
ORDER BY s.reliability_score DESC;
```

**How it works:**
- `LEFT JOIN` ensures suppliers with no shipments still appear
- `CASE WHEN` inside `SUM()` counts delivered vs delayed shipments
- `GROUP BY` aggregates shipment counts per supplier

---

## ⚙️ Backend — FastAPI Application

### How It Works

The backend (`backend/main.py`) is a **FastAPI** application that:

1. **Connects to PostgreSQL** via SQLAlchemy (`backend/database.py`)
2. **Initializes the database** on first startup — runs `schema.sql` and `seed_data.sql`
3. **Serves REST API endpoints** that execute SQL queries and return JSON
4. **Serves the frontend** as static files

### Connection Flow

```
Browser → http://127.0.0.1:8000/
         │
         ├── GET /                    → Serves index.html
         ├── GET /static/style.css    → Serves CSS
         ├── GET /static/script.js    → Serves JS
         │
         └── GET /api/...             → FastAPI executes SQL → returns JSON
                │
                └── SQLAlchemy → psycopg2 → PostgreSQL (supplysight DB)
```

### Database Connection Code (`backend/database.py`)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Connection string format: postgresql://user:password@host:port/database
DATABASE_URL = "postgresql://postgres:Tarun_2006@localhost:5432/supplysight"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
```

**Key concepts:**
- `create_engine()` — creates a connection pool to PostgreSQL
- `SessionLocal()` — creates individual database sessions for each request
- `get_db()` — FastAPI dependency that provides a session and auto-closes it

### API Endpoints

| Method | Endpoint | What It Returns |
|--------|---------|----------------|
| `GET` | `/api/dashboard/summary` | KPI counts (companies, suppliers, alerts, etc.) |
| `GET` | `/api/risks/low-inventory` | Products below minimum threshold |
| `GET` | `/api/risks/delayed-shipments` | Overdue shipments with days_overdue |
| `GET` | `/api/companies` | All companies |
| `GET` | `/api/suppliers` | All suppliers with company name (JOIN) |
| `GET` | `/api/products` | All products with supplier name (JOIN) |
| `GET` | `/api/warehouses` | All warehouses |
| `GET` | `/api/inventory` | All inventory with product & warehouse names |
| `GET` | `/api/shipments` | All shipments with product & supplier names |
| `GET` | `/api/orders` | All orders with company & product names |
| `GET` | `/api/risks` | All risk events |
| `GET` | `/api/suppliers/reliability` | Supplier stats with shipment counts |

### Example API Response

**`GET /api/dashboard/summary`**
```json
{
  "total_companies": 5,
  "total_suppliers": 10,
  "total_products": 15,
  "total_warehouses": 5,
  "total_orders": 12,
  "total_shipments": 15,
  "low_inventory_alerts": 8,
  "delayed_shipment_alerts": 8,
  "open_risks": 7
}
```

---

## 🎨 Frontend — SaaS-Grade Dashboard UI

The dashboard received a comprehensive upgrade to a premium **Yellow/Black** design system with interactive charts, real-time search, and professional data visualization.

### Features
- **8 KPI summary cards** split into two rows — entity counts + alert metrics
- **4 interactive Chart.js charts** — Inventory Levels (horizontal bar), Shipment Delays (bar), Supplier Reliability (bar), Risk Severity (doughnut)
- **Global search** — real-time filtering across all tables
- **Dropdown filters** — filter by Warehouse, Supplier, and Risk Severity
- **Low Inventory alerts** table with color-coded progress bars
- **Delayed Shipments** table showing days overdue
- **Recent Orders** table with status & priority color-coded pills
- **Supplier Reliability** table with visual reliability bar indicators
- **Risk Events Log** with severity pills and truncated descriptions
- **AI Insight Banner** — dynamic status message based on alert thresholds
- **Skeleton loading** — shimmer animations shown while data loads
- **Animated counters** — KPI numbers count up with easing
- **Live clock** — real-time timestamp in the header
- **Section dividers** — labeled sections (Analytics, Risk Alerts, Operations)

### Data Flow
```
Page loads → script.js calls fetch() to 6+ /api/ endpoints in parallel
           → JSON responses parsed with error isolation (try/catch per loader)
           → Tables, charts, and KPIs rendered dynamically
           → Status pills color-coded by severity
           → Filters populate from loaded data
```

### Design System (Yellow/Black Theme)
- **Base colors**: `#08080a` background, `#16161a` cards, `#f5c518` gold accent
- **Gradient accents**: Gold-to-amber gradient on headers, banners, and hover states
- **Ambient glow**: Subtle radial gradient behind the dashboard
- **Typography**: Inter font (Google Fonts) with 300–900 weight range
- **Color-coded status pills**: Safe (green), Warning (amber), Critical (red), Info (blue)
- **Glassmorphism topbar**: Sticky header with `backdrop-filter: blur(20px)`
- **Animations**: Fade-in rows, shimmer skeletons, animated counters, pulse dot, card hover lift
- **Responsive grid**: 4-column → 2-column → 1-column at breakpoints
- **Chart theming**: Dark background, matching accent colors, proper legend styling

### Frontend Dependencies (via CDN)
| Library | Version | Purpose |
|---------|---------|--------|
| Chart.js | 4.4.1 | Bar, doughnut, and horizontal bar charts |
| Inter Font | Latest | Google Fonts — premium typography |

---

## 🚀 How to Run

### Prerequisites
- **Python 3.11+** installed
- **PostgreSQL 17** installed and running

### Step 1 — Create the Database (first time only)

Open PowerShell and run:
```powershell
$env:PGPASSWORD='Tarun_2006'; & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE supplysight;"
```

### Step 2 — Install Python Dependencies (first time only)

```powershell
cd C:\Users\tarun\Desktop\SEM-4\webpDBMS
pip install -r requirements.txt
```

### Step 3 — Start the Server

```powershell
cd C:\Users\tarun\Desktop\SEM-4\webpDBMS
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

You should see:
```
✅ Database seeded with sample data.
✅ Views, triggers, and stored functions loaded.
✅ Database initialized successfully.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 4 — Open Dashboard

Go to **http://127.0.0.1:8000/** in your browser.

### To Stop
Press `Ctrl + C` in the terminal.

---

## 🧪 Testing Checklist

| Test | How to Verify | Status |
|------|--------------|--------|
| Tables created | Check pgAdmin or `\dt` in psql | ✅ |
| Foreign keys working | Try inserting invalid FK → should fail | ✅ |
| Sample data inserted | `GET /api/companies` returns 5 rows | ✅ |
| Low inventory query | `GET /api/risks/low-inventory` returns 8 alerts | ✅ |
| Delayed shipments query | `GET /api/risks/delayed-shipments` returns 8 alerts | ✅ |
| Dashboard displays data | Open http://127.0.0.1:8000/ → all tables populated | ✅ |

---

## 📊 Sample Data Summary

| Table | Records | Highlights |
|-------|---------|-----------|
| Company | 5 | TechNova, GreenLeaf Pharma, AutoDrive, FreshBite, SkyBuild |
| Supplier | 10 | Reliability scores from 0.65 to 0.97, 1 inactive |
| Product | 15 | Electronics, Pharma, Auto Parts, Food, Construction |
| Warehouse | 5 | Dallas, Frankfurt, Singapore, Mumbai, Manchester |
| Inventory | 15 | **8 below threshold** (triggers low-stock risk) |
| Shipment | 15 | **8 overdue** (triggers delayed-shipment risk) |
| Orders | 12 | Mixed statuses: Pending, Processing, Shipped, Delivered |
| Risk Events | 8 | Low Stock, Delayed Delivery, Low Reliability risks |

---

## 🧠 Advanced DBMS Features (v2.1)

### SQL Views (3)

| View | Purpose |
|------|---------|
| `v_dashboard_summary` | Encapsulates all KPI counts in a single query |
| `v_low_inventory` | 4-table JOIN for low stock detection, reusable across API |
| `v_supplier_performance` | Aggregated supplier reliability with shipment counts |

### Triggers (2)

| Trigger | Event | Action |
|---------|-------|--------|
| `trg_inventory_risk` | AFTER UPDATE on `inventory` | Auto-creates risk event when stock drops below threshold |
| `trg_shipment_delay` | AFTER UPDATE on `shipment` | Auto-creates risk event when status changes to 'Delayed' |

### Stored Functions (2)

| Function | Purpose |
|----------|---------|
| `fn_detect_all_risks()` | Scans inventory + shipments, bulk-creates new risk events |
| `fn_place_order(company, product, qty, priority)` | **Transaction demo**: validates stock → inserts order → reduces inventory → updates status, all atomically with ROLLBACK on error |

### Full CRUD API Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| `GET` | `/api/dashboard/summary` | KPI counts (uses `v_dashboard_summary` view) |
| `GET` | `/api/risks/low-inventory` | Low stock items (uses `v_low_inventory` view) |
| `GET` | `/api/suppliers/reliability` | Supplier stats (uses `v_supplier_performance` view) |
| `POST` | `/api/orders` | Place order via `fn_place_order` stored function (transaction) |
| `PUT` | `/api/risks/{id}/resolve` | Mark a risk as Resolved |
| `PUT` | `/api/shipments/{id}/status` | Update shipment status (triggers `trg_shipment_delay`) |
| `DELETE` | `/api/risks/{id}` | Dismiss a risk event |
| `POST` | `/api/risks/detect` | Run `fn_detect_all_risks()` to scan for new risks |

---

## 🎓 What This Project Demonstrates

| Concept | Implementation |
|---------|---------------|
| **ER-based relational design** | 8 tables derived from entity-relationship model |
| **Normalization (3NF)** | No transitive dependencies, proper decomposition |
| **Primary & Foreign Keys** | SERIAL PKs, FK constraints with ON DELETE CASCADE |
| **CHECK constraints** | Enum-like status fields, range validations |
| **Associative tables** | `inventory` resolves Product↔Warehouse M:N |
| **Complex JOINs** | 3–4 table JOINs in risk and reliability queries |
| **Aggregate queries** | COUNT, SUM, CASE WHEN for analytics |
| **Date operations** | CURRENT_DATE for overdue calculation |
| **SQL Views** | 3 views for dashboard, low inventory, supplier performance |
| **Triggers** | 2 AFTER UPDATE triggers for automated risk detection |
| **Stored Functions** | `fn_detect_all_risks()`, `fn_place_order()` with transactions |
| **Transactions** | `fn_place_order` uses BEGIN/EXCEPTION for atomicity |
| **Full CRUD** | GET + POST + PUT + DELETE via REST API |
| **REST API design** | FastAPI with proper endpoint naming |
| **ORM usage** | SQLAlchemy models mapping to PostgreSQL tables |
| **Web data visualization** | Fetch API → dynamic HTML table rendering |

---

## 🚀 Future Improvements

- 🔐 Authentication & Authorization
- 🔄 Real-time alerts (WebSockets)
- 🤖 AI-powered supply chain predictions
- 📋 Role-based dashboards (Admin, Manager, Viewer)
- 📤 Export to CSV/PDF functionality
- 🗓️ Date range filtering for historical analysis

### ✅ Already Implemented (v2.1)
- ~~📊 Charts & Analytics~~ → 4 Chart.js charts (bar, doughnut)
- ~~📱 Mobile-responsive enhancements~~ → Full responsive grid (4→2→1 columns)
- ~~🔍 Search & Filters~~ → Global search + warehouse/supplier/severity filters
- ~~⏳ Loading states~~ → Skeleton shimmer animations
- ~~🎨 Premium design~~ → Yellow/Black SaaS theme with glassmorphism
- ~~🧠 Triggers & Stored Procedures~~ → 2 triggers + 2 stored functions
- ~~🔁 Full CRUD~~ → POST/PUT/DELETE with transaction demo
- ~~📋 SQL Views~~ → 3 views replacing inline queries

---

*Built for SEM-4 Web Programming + DBMS coursework — February 2026*
