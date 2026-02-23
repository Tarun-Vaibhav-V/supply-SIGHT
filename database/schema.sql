-- SupplySight Database Schema (PostgreSQL)
-- Normalized to 3NF with full FK relationships

-- 1. COMPANY (Master Entity)
CREATE TABLE IF NOT EXISTS company (
    company_id SERIAL PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    industry VARCHAR(100),
    country VARCHAR(100),
    contact_email VARCHAR(150),
    contact_phone VARCHAR(30),
    created_at DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended'))
);

-- 2. SUPPLIER
CREATE TABLE IF NOT EXISTS supplier (
    supplier_id SERIAL PRIMARY KEY,
    supplier_name VARCHAR(150) NOT NULL,
    company_id INT NOT NULL,
    country VARCHAR(100),
    lead_time_days INT CHECK (lead_time_days >= 0),
    reliability_score DECIMAL(3,2) CHECK (reliability_score BETWEEN 0 AND 1),
    contact_email VARCHAR(150),
    active_status BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
);

-- 3. PRODUCT
CREATE TABLE IF NOT EXISTS product (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    supplier_id INT NOT NULL,
    category VARCHAR(100),
    unit_price DECIMAL(12,2) CHECK (unit_price >= 0),
    reorder_level INT DEFAULT 10 CHECK (reorder_level >= 0),
    weight_kg DECIMAL(8,2),
    active_status BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id) ON DELETE CASCADE
);

-- 4. WAREHOUSE
CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(150) NOT NULL,
    location_city VARCHAR(100),
    location_country VARCHAR(100),
    capacity_units INT CHECK (capacity_units > 0),
    manager_name VARCHAR(100),
    contact_number VARCHAR(30),
    active_status BOOLEAN DEFAULT TRUE
);

-- 5. INVENTORY (Associative: Product <-> Warehouse M:N)
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    quantity_available INT DEFAULT 0 CHECK (quantity_available >= 0),
    reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
    last_updated DATE DEFAULT CURRENT_DATE,
    minimum_threshold INT DEFAULT 10 CHECK (minimum_threshold >= 0),
    inventory_status VARCHAR(30) DEFAULT 'In Stock' CHECK (inventory_status IN ('In Stock', 'Low Stock', 'Out of Stock')),
    FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id) ON DELETE CASCADE
);

-- 6. SHIPMENT
CREATE TABLE IF NOT EXISTS shipment (
    shipment_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    supplier_id INT NOT NULL,
    quantity_shipped INT CHECK (quantity_shipped > 0),
    expected_delivery_date DATE NOT NULL,
    actual_delivery_date DATE,
    shipment_status VARCHAR(30) DEFAULT 'In Transit' CHECK (shipment_status IN ('In Transit', 'Delivered', 'Delayed', 'Cancelled')),
    transport_mode VARCHAR(30) CHECK (transport_mode IN ('Air', 'Sea', 'Road', 'Rail')),
    FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES supplier(supplier_id) ON DELETE CASCADE
);

-- 7. ORDERS (using "orders" to avoid reserved word "ORDER")
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    company_id INT NOT NULL,
    product_id INT NOT NULL,
    order_quantity INT CHECK (order_quantity > 0),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_fulfill_date DATE,
    order_status VARCHAR(30) DEFAULT 'Pending' CHECK (order_status IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
    priority_level VARCHAR(20) DEFAULT 'Medium' CHECK (priority_level IN ('Low', 'Medium', 'High', 'Critical')),
    FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE
);

-- 8. RISK_EVENT
CREATE TABLE IF NOT EXISTS risk_event (
    risk_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('Supplier', 'Product', 'Shipment', 'Inventory', 'Warehouse', 'Order')),
    entity_id INT NOT NULL,
    risk_type VARCHAR(50) NOT NULL,
    risk_severity VARCHAR(20) DEFAULT 'Medium' CHECK (risk_severity IN ('Low', 'Medium', 'High', 'Critical')),
    detected_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    resolution_status VARCHAR(30) DEFAULT 'Open' CHECK (resolution_status IN ('Open', 'Investigating', 'Resolved', 'Dismissed'))
);
