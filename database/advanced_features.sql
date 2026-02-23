-- ═══════════════════════════════════════════════════════════════════
-- SupplySight — Advanced DBMS Features
-- Views · Triggers · Stored Functions · Transactions
-- ═══════════════════════════════════════════════════════════════════


-- ─── VIEWS ─────────────────────────────────────────────────────────

-- View 1: Dashboard Summary (encapsulates KPI counts)
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM company)   AS total_companies,
    (SELECT COUNT(*) FROM supplier)  AS total_suppliers,
    (SELECT COUNT(*) FROM product)   AS total_products,
    (SELECT COUNT(*) FROM warehouse) AS total_warehouses,
    (SELECT COUNT(*) FROM orders)    AS total_orders,
    (SELECT COUNT(*) FROM shipment)  AS total_shipments,
    (SELECT COUNT(*) FROM inventory
     WHERE quantity_available < minimum_threshold) AS low_inventory_alerts,
    (SELECT COUNT(*) FROM shipment
     WHERE actual_delivery_date IS NULL
       AND expected_delivery_date < CURRENT_DATE) AS delayed_shipment_alerts,
    (SELECT COUNT(*) FROM risk_event
     WHERE resolution_status IN ('Open', 'Investigating')) AS open_risks;


-- View 2: Low Inventory Details (4-table JOIN)
CREATE OR REPLACE VIEW v_low_inventory AS
SELECT
    i.inventory_id,
    p.product_name,
    p.category,
    s.supplier_name,
    w.warehouse_name,
    i.quantity_available,
    i.minimum_threshold,
    i.inventory_status,
    i.last_updated
FROM inventory i
JOIN product p   ON i.product_id  = p.product_id
JOIN supplier s  ON p.supplier_id = s.supplier_id
JOIN warehouse w ON i.warehouse_id = w.warehouse_id
WHERE i.quantity_available < i.minimum_threshold
ORDER BY (i.minimum_threshold - i.quantity_available) DESC;


-- View 3: Supplier Performance (aggregated shipment stats)
CREATE OR REPLACE VIEW v_supplier_performance AS
SELECT
    s.supplier_id,
    s.supplier_name,
    s.country,
    s.reliability_score,
    s.lead_time_days,
    s.active_status,
    c.company_name,
    COUNT(sh.shipment_id) AS total_shipments,
    SUM(CASE WHEN sh.shipment_status = 'Delivered' THEN 1 ELSE 0 END) AS delivered,
    SUM(CASE WHEN sh.shipment_status = 'Delayed'   THEN 1 ELSE 0 END) AS delayed
FROM supplier s
JOIN company c ON s.company_id = c.company_id
LEFT JOIN shipment sh ON s.supplier_id = sh.supplier_id
GROUP BY s.supplier_id, s.supplier_name, s.country,
         s.reliability_score, s.lead_time_days, s.active_status, c.company_name
ORDER BY s.reliability_score DESC;


-- ─── TRIGGERS ──────────────────────────────────────────────────────

-- Trigger Function 1: Auto-create risk event when inventory drops below threshold
CREATE OR REPLACE FUNCTION fn_trg_inventory_risk()
RETURNS TRIGGER AS $$
BEGIN
    -- Only fire if quantity just dropped below threshold
    IF NEW.quantity_available < NEW.minimum_threshold
       AND (OLD.quantity_available >= OLD.minimum_threshold
            OR OLD.quantity_available IS NULL) THEN

        -- Check for existing open risk on this inventory
        IF NOT EXISTS (
            SELECT 1 FROM risk_event
            WHERE entity_type = 'Inventory'
              AND entity_id = NEW.inventory_id
              AND risk_type = 'Low Stock'
              AND resolution_status IN ('Open', 'Investigating')
        ) THEN
            INSERT INTO risk_event (entity_type, entity_id, risk_type, risk_severity, description)
            VALUES (
                'Inventory',
                NEW.inventory_id,
                'Low Stock',
                CASE
                    WHEN NEW.quantity_available = 0 THEN 'Critical'
                    WHEN NEW.quantity_available < NEW.minimum_threshold * 0.3 THEN 'High'
                    ELSE 'Medium'
                END,
                'Auto-detected: Stock at ' || NEW.quantity_available
                || ' units, below threshold of ' || NEW.minimum_threshold || ' units'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and re-create the trigger to avoid errors on re-run
DROP TRIGGER IF EXISTS trg_inventory_risk ON inventory;
CREATE TRIGGER trg_inventory_risk
    AFTER UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_inventory_risk();


-- Trigger Function 2: Auto-create risk event when shipment status changes to 'Delayed'
CREATE OR REPLACE FUNCTION fn_trg_shipment_delay()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.shipment_status = 'Delayed' AND OLD.shipment_status <> 'Delayed' THEN
        -- Check for existing open risk on this shipment
        IF NOT EXISTS (
            SELECT 1 FROM risk_event
            WHERE entity_type = 'Shipment'
              AND entity_id = NEW.shipment_id
              AND risk_type = 'Delayed Delivery'
              AND resolution_status IN ('Open', 'Investigating')
        ) THEN
            INSERT INTO risk_event (entity_type, entity_id, risk_type, risk_severity, description)
            VALUES (
                'Shipment',
                NEW.shipment_id,
                'Delayed Delivery',
                'High',
                'Auto-detected: Shipment #' || NEW.shipment_id
                || ' status changed to Delayed'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shipment_delay ON shipment;
CREATE TRIGGER trg_shipment_delay
    AFTER UPDATE ON shipment
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_shipment_delay();


-- ─── STORED FUNCTIONS ──────────────────────────────────────────────

-- Function 1: Detect All Risks (bulk scan)
-- Scans inventory + shipments and creates risk_events for any new issues
CREATE OR REPLACE FUNCTION fn_detect_all_risks()
RETURNS TABLE(new_risks_created INT) AS $$
DECLARE
    v_count INT := 0;
    rec RECORD;
BEGIN
    -- Scan low inventory
    FOR rec IN
        SELECT i.inventory_id, i.quantity_available, i.minimum_threshold
        FROM inventory i
        WHERE i.quantity_available < i.minimum_threshold
          AND NOT EXISTS (
              SELECT 1 FROM risk_event r
              WHERE r.entity_type = 'Inventory'
                AND r.entity_id = i.inventory_id
                AND r.risk_type = 'Low Stock'
                AND r.resolution_status IN ('Open', 'Investigating')
          )
    LOOP
        INSERT INTO risk_event (entity_type, entity_id, risk_type, risk_severity, description)
        VALUES (
            'Inventory', rec.inventory_id, 'Low Stock',
            CASE
                WHEN rec.quantity_available = 0 THEN 'Critical'
                WHEN rec.quantity_available < rec.minimum_threshold * 0.3 THEN 'High'
                ELSE 'Medium'
            END,
            'Scan-detected: Stock at ' || rec.quantity_available
            || '/' || rec.minimum_threshold || ' units'
        );
        v_count := v_count + 1;
    END LOOP;

    -- Scan delayed shipments
    FOR rec IN
        SELECT sh.shipment_id,
               (CURRENT_DATE - sh.expected_delivery_date) AS days_overdue
        FROM shipment sh
        WHERE sh.actual_delivery_date IS NULL
          AND sh.expected_delivery_date < CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM risk_event r
              WHERE r.entity_type = 'Shipment'
                AND r.entity_id = sh.shipment_id
                AND r.risk_type = 'Delayed Delivery'
                AND r.resolution_status IN ('Open', 'Investigating')
          )
    LOOP
        INSERT INTO risk_event (entity_type, entity_id, risk_type, risk_severity, description)
        VALUES (
            'Shipment', rec.shipment_id, 'Delayed Delivery',
            CASE
                WHEN rec.days_overdue > 10 THEN 'Critical'
                WHEN rec.days_overdue > 5  THEN 'High'
                ELSE 'Medium'
            END,
            'Scan-detected: Shipment #' || rec.shipment_id
            || ' is ' || rec.days_overdue || ' days overdue'
        );
        v_count := v_count + 1;
    END LOOP;

    new_risks_created := v_count;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;


-- Function 2: Place Order (Transaction Demo)
-- Validates stock → inserts order → reduces inventory → updates status
-- All inside a transaction (BEGIN is implicit; EXCEPTION triggers ROLLBACK)
CREATE OR REPLACE FUNCTION fn_place_order(
    p_company_id INT,
    p_product_id INT,
    p_quantity INT,
    p_priority VARCHAR DEFAULT 'Medium'
)
RETURNS TABLE(
    order_id INT,
    message TEXT
) AS $$
DECLARE
    v_order_id INT;
    v_available INT;
    v_inv_id INT;
    v_threshold INT;
BEGIN
    -- Step 1: Check inventory availability
    SELECT i.inventory_id, i.quantity_available, i.minimum_threshold
    INTO v_inv_id, v_available, v_threshold
    FROM inventory i
    JOIN product p ON i.product_id = p.product_id
    WHERE p.product_id = p_product_id
    ORDER BY i.quantity_available DESC
    LIMIT 1;

    IF v_inv_id IS NULL THEN
        RAISE EXCEPTION 'No inventory found for product_id %', p_product_id;
    END IF;

    IF v_available < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock: available=%, requested=%', v_available, p_quantity;
    END IF;

    -- Step 2: Insert order
    INSERT INTO orders (company_id, product_id, order_quantity,
                        expected_fulfill_date, priority_level)
    VALUES (p_company_id, p_product_id, p_quantity,
            CURRENT_DATE + INTERVAL '7 days', p_priority)
    RETURNING orders.order_id INTO v_order_id;

    -- Step 3: Reduce inventory (triggers trg_inventory_risk if below threshold)
    UPDATE inventory
    SET quantity_available = quantity_available - p_quantity,
        last_updated = CURRENT_DATE,
        inventory_status = CASE
            WHEN (quantity_available - p_quantity) = 0 THEN 'Out of Stock'
            WHEN (quantity_available - p_quantity) < minimum_threshold THEN 'Low Stock'
            ELSE 'In Stock'
        END
    WHERE inventory_id = v_inv_id;

    -- Step 4: Return success
    order_id := v_order_id;
    message := 'Order #' || v_order_id || ' placed. Inventory reduced by ' || p_quantity || ' units.';
    RETURN NEXT;

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction auto-rolls back on exception in PL/pgSQL
        RAISE;
END;
$$ LANGUAGE plpgsql;


-- ─── INDEXES (Performance) ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse  ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shipment_expected    ON shipment(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_shipment_supplier    ON shipment(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_company       ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_product       ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_risk_entity          ON risk_event(entity_type, entity_id);
