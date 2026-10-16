-- ============================================================================
-- PlayStoreIQ Data Warehouse — Star Schema DDL
-- Compatible with PostgreSQL 15+ and SQLite 3.35+
-- ============================================================================

-- Drop tables if re-initializing
DROP TABLE IF EXISTS fact_app;
DROP TABLE IF EXISTS dim_app;
DROP TABLE IF EXISTS dim_date;
DROP TABLE IF EXISTS dim_category;
DROP TABLE IF EXISTS dim_type;
DROP TABLE IF EXISTS dim_genre;
DROP TABLE IF EXISTS dim_content_rating;
DROP TABLE IF EXISTS dim_android_version;

-- 1. Dim_App (Application Details)
CREATE TABLE dim_app (
    app_id INTEGER PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL UNIQUE,
    current_ver VARCHAR(64) DEFAULT 'Unknown',
    is_free BOOLEAN NOT NULL DEFAULT 1
);

-- 2. Dim_Date (Temporal Hierarchy)
CREATE TABLE dim_date (
    date_id INTEGER PRIMARY KEY,
    full_date DATE NOT NULL UNIQUE,
    day_num INTEGER NOT NULL,
    month_num INTEGER NOT NULL,
    month_name VARCHAR(16) NOT NULL,
    quarter_num INTEGER NOT NULL,
    year_num INTEGER NOT NULL,
    day_of_week VARCHAR(16) NOT NULL
);

-- 3. Dim_Category (Classification Hierarchy)
CREATE TABLE dim_category (
    category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(64) NOT NULL UNIQUE,
    domain_group VARCHAR(64) NOT NULL
);

-- 4. Dim_Type (Pricing / Commercial Model)
CREATE TABLE dim_type (
    type_id INTEGER PRIMARY KEY,
    type_name VARCHAR(16) NOT NULL UNIQUE
);

-- 5. Dim_Genre (Genre Classification)
CREATE TABLE dim_genre (
    genre_id INTEGER PRIMARY KEY,
    genre_name VARCHAR(128) NOT NULL UNIQUE,
    primary_genre VARCHAR(64) NOT NULL
);

-- 6. Dim_ContentRating (Age / Maturity Tier)
CREATE TABLE dim_content_rating (
    content_rating_id INTEGER PRIMARY KEY,
    rating_name VARCHAR(32) NOT NULL UNIQUE,
    age_tier VARCHAR(32) NOT NULL
);

-- 7. Dim_AndroidVersion (OS Compatibility)
CREATE TABLE dim_android_version (
    android_ver_id INTEGER PRIMARY KEY,
    raw_version VARCHAR(64) NOT NULL UNIQUE,
    min_version FLOAT NOT NULL
);

-- ============================================================================
-- Central Fact Table: Fact_App
-- Grain: One record per distinct application
-- Measures: Rating, Reviews, Installs, Price, Size, Sentiment
-- ============================================================================
CREATE TABLE fact_app (
    fact_id INTEGER PRIMARY KEY,
    app_id INTEGER NOT NULL REFERENCES dim_app(app_id),
    date_id INTEGER NOT NULL REFERENCES dim_date(date_id),
    category_id INTEGER NOT NULL REFERENCES dim_category(category_id),
    type_id INTEGER NOT NULL REFERENCES dim_type(type_id),
    genre_id INTEGER NOT NULL REFERENCES dim_genre(genre_id),
    content_rating_id INTEGER NOT NULL REFERENCES dim_content_rating(content_rating_id),
    android_ver_id INTEGER NOT NULL REFERENCES dim_android_version(android_ver_id),
    
    -- Numerical Measures
    rating NUMERIC(3, 2),
    reviews_count BIGINT NOT NULL DEFAULT 0,
    installs_count BIGINT NOT NULL DEFAULT 0,
    price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    size_mb NUMERIC(8, 2),
    
    -- Review / Sentiment Measures
    avg_sentiment_polarity NUMERIC(4, 3),
    avg_sentiment_subjectivity NUMERIC(4, 3),
    total_review_records INTEGER NOT NULL DEFAULT 0,
    
    -- Mining Target Label (0 = Low, 1 = Med, 2 = High)
    popularity_class INTEGER NOT NULL
);

-- Indexes for Fast OLAP Queries & Joins
CREATE INDEX idx_fact_category ON fact_app(category_id);
CREATE INDEX idx_fact_date ON fact_app(date_id);
CREATE INDEX idx_fact_type ON fact_app(type_id);
CREATE INDEX idx_fact_genre ON fact_app(genre_id);
CREATE INDEX idx_fact_content_rating ON fact_app(content_rating_id);
CREATE INDEX idx_fact_popularity ON fact_app(popularity_class);
