-- SupplySight Sample Data Seed
-- Includes scenarios for risk detection (low inventory, delayed shipments)

-- ==================== COMPANIES ====================
INSERT INTO company (company_name, industry, country, contact_email, contact_phone, created_at, status) VALUES
('TechNova Inc.', 'Technology', 'United States', 'info@technova.com', '+1-555-0101', '2024-01-15', 'Active'),
('GreenLeaf Pharma', 'Pharmaceutical', 'Germany', 'contact@greenleaf.de', '+49-30-12345', '2024-02-20', 'Active'),
('AutoDrive Corp', 'Automotive', 'Japan', 'hello@autodrive.jp', '+81-3-9876', '2024-03-10', 'Active'),
('FreshBite Foods', 'Food & Beverage', 'India', 'ops@freshbite.in', '+91-22-55500', '2024-04-05', 'Active'),
('SkyBuild Construction', 'Construction', 'United Kingdom', 'admin@skybuild.co.uk', '+44-20-7890', '2024-05-18', 'Active');

-- ==================== SUPPLIERS ====================
INSERT INTO supplier (supplier_name, company_id, country, lead_time_days, reliability_score, contact_email, active_status) VALUES
('ChipMakers Ltd', 1, 'Taiwan', 14, 0.92, 'sales@chipmakers.tw', TRUE),
('SteelForge Industries', 1, 'South Korea', 21, 0.85, 'orders@steelforge.kr', TRUE),
('PharmaSource AG', 2, 'Switzerland', 10, 0.97, 'supply@pharmasource.ch', TRUE),
('BioLab Materials', 2, 'Germany', 7, 0.88, 'info@biolab.de', TRUE),
('MotorParts Japan', 3, 'Japan', 18, 0.91, 'parts@motorparts.jp', TRUE),
('RubberTech Co', 3, 'Thailand', 25, 0.72, 'sales@rubbertech.th', TRUE),
('AgroSupply India', 4, 'India', 5, 0.94, 'supply@agrosupply.in', TRUE),
('PackWell Solutions', 4, 'Vietnam', 12, 0.80, 'hello@packwell.vn', TRUE),
('CementKing PLC', 5, 'United Kingdom', 8, 0.89, 'orders@cementking.uk', TRUE),
('TimberWorld', 5, 'Canada', 15, 0.65, 'sales@timberworld.ca', FALSE);

-- ==================== PRODUCTS ====================
INSERT INTO product (product_name, supplier_id, category, unit_price, reorder_level, weight_kg, active_status) VALUES
('Microprocessor X200', 1, 'Electronics', 45.99, 100, 0.05, TRUE),
('DRAM Module 16GB', 1, 'Electronics', 22.50, 200, 0.02, TRUE),
('Carbon Steel Sheet', 2, 'Raw Material', 120.00, 50, 25.00, TRUE),
('Paracetamol API', 3, 'Active Ingredient', 85.00, 150, 0.50, TRUE),
('Gelatin Capsules 00', 4, 'Packaging', 12.00, 500, 0.01, TRUE),
('Brake Disc Assembly', 5, 'Auto Parts', 67.50, 80, 3.20, TRUE),
('Natural Rubber Compound', 6, 'Raw Material', 35.00, 300, 10.00, TRUE),
('Organic Wheat Flour', 7, 'Ingredient', 8.50, 1000, 25.00, TRUE),
('HDPE Packaging Film', 8, 'Packaging', 3.25, 2000, 0.10, TRUE),
('Portland Cement Type I', 9, 'Construction Material', 15.00, 500, 50.00, TRUE),
('Plywood Sheet 18mm', 10, 'Construction Material', 28.00, 200, 15.00, TRUE),
('LED Display Panel 15"', 1, 'Electronics', 135.00, 60, 1.20, TRUE),
('Stainless Steel Rod', 2, 'Raw Material', 55.00, 100, 8.50, TRUE),
('Amoxicillin Trihydrate', 3, 'Active Ingredient', 110.00, 120, 0.80, TRUE),
('Tire Rubber Compound', 6, 'Raw Material', 42.00, 250, 12.00, TRUE);

-- ==================== WAREHOUSES ====================
INSERT INTO warehouse (warehouse_name, location_city, location_country, capacity_units, manager_name, contact_number, active_status) VALUES
('Central Hub - Dallas', 'Dallas', 'United States', 50000, 'Michael Johnson', '+1-555-2001', TRUE),
('Euro Distribution Center', 'Frankfurt', 'Germany', 35000, 'Anna Schmidt', '+49-69-44400', TRUE),
('Asia Pacific Warehouse', 'Singapore', 'Singapore', 40000, 'Wei Lin', '+65-6789-0000', TRUE),
('Mumbai Logistics Park', 'Mumbai', 'India', 30000, 'Rajesh Patel', '+91-22-66600', TRUE),
('UK Fulfillment Center', 'Manchester', 'United Kingdom', 25000, 'James Wilson', '+44-161-5550', TRUE);

-- ==================== INVENTORY ====================
-- Some items are deliberately LOW STOCK (below minimum_threshold) for risk detection
INSERT INTO inventory (product_id, warehouse_id, quantity_available, reserved_quantity, last_updated, minimum_threshold, inventory_status) VALUES
(1, 1, 250, 30, '2026-02-10', 100, 'In Stock'),
(2, 1, 45, 10, '2026-02-12', 200, 'Low Stock'),          -- LOW: 45 < 200
(3, 1, 120, 20, '2026-02-11', 50, 'In Stock'),
(4, 2, 30, 5, '2026-02-13', 150, 'Low Stock'),            -- LOW: 30 < 150
(5, 2, 800, 50, '2026-02-10', 500, 'In Stock'),
(6, 3, 15, 5, '2026-02-14', 80, 'Low Stock'),             -- LOW: 15 < 80
(7, 3, 50, 0, '2026-02-09', 300, 'Low Stock'),            -- LOW: 50 < 300
(8, 4, 2500, 200, '2026-02-12', 1000, 'In Stock'),
(9, 4, 500, 100, '2026-02-11', 2000, 'Low Stock'),        -- LOW: 500 < 2000
(10, 5, 1200, 150, '2026-02-13', 500, 'In Stock'),
(11, 5, 80, 10, '2026-02-10', 200, 'Low Stock'),          -- LOW: 80 < 200
(12, 1, 95, 15, '2026-02-14', 60, 'In Stock'),
(13, 3, 200, 30, '2026-02-12', 100, 'In Stock'),
(14, 2, 25, 5, '2026-02-13', 120, 'Low Stock'),           -- LOW: 25 < 120
(15, 3, 0, 0, '2026-02-08', 250, 'Out of Stock');         -- LOW: 0 < 250

-- ==================== SHIPMENTS ====================
-- Some shipments are DELAYED (expected before today, no actual delivery) for risk detection
INSERT INTO shipment (product_id, supplier_id, quantity_shipped, expected_delivery_date, actual_delivery_date, shipment_status, transport_mode) VALUES
(1, 1, 500, '2026-02-10', '2026-02-09', 'Delivered', 'Air'),
(2, 1, 300, '2026-02-08', NULL, 'Delayed', 'Sea'),        -- DELAYED
(3, 2, 100, '2026-02-12', '2026-02-12', 'Delivered', 'Sea'),
(4, 3, 200, '2026-02-05', NULL, 'Delayed', 'Air'),        -- DELAYED
(5, 4, 1000, '2026-02-15', NULL, 'In Transit', 'Sea'),
(6, 5, 150, '2026-02-01', NULL, 'Delayed', 'Road'),       -- DELAYED
(7, 6, 400, '2026-02-03', NULL, 'Delayed', 'Sea'),        -- DELAYED
(8, 7, 3000, '2026-02-14', '2026-02-13', 'Delivered', 'Road'),
(9, 8, 2000, '2026-02-18', NULL, 'In Transit', 'Sea'),
(10, 9, 800, '2026-02-07', NULL, 'Delayed', 'Rail'),      -- DELAYED
(11, 10, 300, '2026-02-20', NULL, 'In Transit', 'Sea'),
(12, 1, 100, '2026-02-11', NULL, 'Delayed', 'Air'),       -- DELAYED
(13, 2, 250, '2026-02-16', NULL, 'In Transit', 'Rail'),
(14, 3, 180, '2026-02-06', NULL, 'Delayed', 'Air'),       -- DELAYED
(15, 6, 500, '2026-02-04', NULL, 'Delayed', 'Sea');       -- DELAYED

-- ==================== ORDERS ====================
INSERT INTO orders (company_id, product_id, order_quantity, order_date, expected_fulfill_date, order_status, priority_level) VALUES
(1, 1, 500, '2026-02-01', '2026-02-15', 'Processing', 'High'),
(1, 2, 1000, '2026-02-03', '2026-02-17', 'Pending', 'Critical'),
(2, 4, 300, '2026-02-05', '2026-02-18', 'Processing', 'High'),
(2, 5, 2000, '2026-02-06', '2026-02-20', 'Shipped', 'Medium'),
(3, 6, 200, '2026-02-07', '2026-02-22', 'Pending', 'Critical'),
(3, 7, 800, '2026-02-08', '2026-02-25', 'Pending', 'High'),
(4, 8, 5000, '2026-02-09', '2026-02-16', 'Delivered', 'Medium'),
(4, 9, 3000, '2026-02-10', '2026-02-19', 'Processing', 'Low'),
(5, 10, 1000, '2026-02-11', '2026-02-21', 'Shipped', 'Medium'),
(5, 11, 500, '2026-02-12', '2026-02-24', 'Pending', 'High'),
(1, 12, 150, '2026-02-13', '2026-02-23', 'Pending', 'Low'),
(3, 15, 600, '2026-02-14', '2026-02-28', 'Processing', 'Critical');

-- ==================== RISK EVENTS ====================
INSERT INTO risk_event (entity_type, entity_id, risk_type, risk_severity, detected_date, description, resolution_status) VALUES
('Inventory', 2, 'Low Stock', 'High', '2026-02-12', 'DRAM Module 16GB stock at 45 units, below threshold of 200', 'Open'),
('Inventory', 4, 'Low Stock', 'Critical', '2026-02-13', 'Paracetamol API stock critically low at 30 units vs 150 threshold', 'Investigating'),
('Shipment', 2, 'Delayed Delivery', 'High', '2026-02-09', 'DRAM Module shipment overdue since Feb 8 — Sea transport delay', 'Investigating'),
('Shipment', 4, 'Delayed Delivery', 'Critical', '2026-02-06', 'Paracetamol API shipment overdue since Feb 5', 'Open'),
('Supplier', 6, 'Low Reliability', 'Medium', '2026-02-10', 'RubberTech Co reliability score dropped to 0.72', 'Open'),
('Supplier', 10, 'Inactive Supplier', 'Low', '2026-02-08', 'TimberWorld marked inactive — supply chain risk for construction materials', 'Dismissed'),
('Inventory', 15, 'Out of Stock', 'Critical', '2026-02-08', 'Tire Rubber Compound completely out of stock', 'Open'),
('Shipment', 6, 'Delayed Delivery', 'High', '2026-02-02', 'Brake Disc Assembly shipment overdue since Feb 1', 'Investigating');
