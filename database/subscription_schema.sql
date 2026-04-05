-- ═══════════════════════════════════════════════════════════════
-- SupplySight — Subscription & Payment Schema
-- ═══════════════════════════════════════════════════════════════

-- Subscription plans (3 tiers)
CREATE TABLE IF NOT EXISTS subscription_plan (
    plan_id        SERIAL PRIMARY KEY,
    plan_name      VARCHAR(50) NOT NULL UNIQUE,
    price_monthly  DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_suppliers  INT,            -- NULL = unlimited
    max_products   INT,            -- NULL = unlimited
    has_pipeline   BOOLEAN DEFAULT FALSE,
    has_map        BOOLEAN DEFAULT FALSE,
    has_ai_chat    BOOLEAN DEFAULT FALSE,
    ai_chat_limit  INT DEFAULT 0,  -- 0 = none, -1 = unlimited
    has_export     BOOLEAN DEFAULT FALSE,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT NOW()
);

-- User subscriptions with Razorpay payment tracking
CREATE TABLE IF NOT EXISTS user_subscription (
    subscription_id      SERIAL PRIMARY KEY,
    user_id              INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    plan_id              INT NOT NULL REFERENCES subscription_plan(plan_id),
    status               VARCHAR(20) DEFAULT 'active'
                         CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    razorpay_order_id    VARCHAR(100),
    razorpay_payment_id  VARCHAR(100),
    razorpay_signature   VARCHAR(255),
    amount_paid          DECIMAL(10,2),
    started_at           TIMESTAMP DEFAULT NOW(),
    expires_at           TIMESTAMP,
    created_at           TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_sub_user ON user_subscription(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sub_status ON user_subscription(user_id, status);

-- ═══════════════════════════════════════════════════════════════
-- Seed the 3 subscription plans
-- ═══════════════════════════════════════════════════════════════
INSERT INTO subscription_plan (plan_name, price_monthly, max_suppliers, max_products, has_pipeline, has_map, has_ai_chat, ai_chat_limit, has_export)
SELECT 'Starter', 0, 3, 10, FALSE, FALSE, FALSE, 0, FALSE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plan WHERE plan_name = 'Starter');

INSERT INTO subscription_plan (plan_name, price_monthly, max_suppliers, max_products, has_pipeline, has_map, has_ai_chat, ai_chat_limit, has_export)
SELECT 'Professional', 999, 25, 100, TRUE, TRUE, TRUE, 50, FALSE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plan WHERE plan_name = 'Professional');

INSERT INTO subscription_plan (plan_name, price_monthly, max_suppliers, max_products, has_pipeline, has_map, has_ai_chat, ai_chat_limit, has_export)
SELECT 'Enterprise', 2999, NULL, NULL, TRUE, TRUE, TRUE, -1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plan WHERE plan_name = 'Enterprise');

-- Auto-assign Starter (free) plan to existing users who don't have one
INSERT INTO user_subscription (user_id, plan_id, status, amount_paid, expires_at)
SELECT u.user_id, 
       (SELECT plan_id FROM subscription_plan WHERE plan_name = 'Starter'),
       'active', 0, NULL
FROM app_user u
WHERE NOT EXISTS (
    SELECT 1 FROM user_subscription us WHERE us.user_id = u.user_id AND us.status = 'active'
);
