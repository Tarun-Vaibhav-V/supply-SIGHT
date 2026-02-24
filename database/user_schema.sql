-- SupplySight — User Authentication Schema
-- Adds app_user table for login/registration

CREATE TABLE IF NOT EXISTS app_user (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name     VARCHAR(150) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'company'
                  CHECK (role IN ('admin', 'company')),
    company_id    INT REFERENCES company(company_id) ON DELETE SET NULL,
    auth_provider VARCHAR(20) DEFAULT 'email'
                  CHECK (auth_provider IN ('email', 'google')),
    google_id     VARCHAR(100),
    avatar_url    VARCHAR(500),
    created_at    TIMESTAMP DEFAULT NOW(),
    last_login    TIMESTAMP
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_user_email ON app_user(email);
