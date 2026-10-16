# PlayStoreIQ — Star Schema & Dimensional Model Specification

**Project:** Google Play Store Business Intelligence & Data Warehouse Mining System  
**Evaluation Standard:** Academic & Production DWM Dimensional Model  
**Date:** October 2026  

---

## 1. Dimensional Model Overview
PlayStoreIQ implements an authentic **Star Schema** data warehouse architecture. The dimensional model decouples business context dimensions from additive and semi-additive analytical measures, optimizing multi-dimensional aggregation, analytical querying, and online analytical processing (OLAP).

```
                      ┌──────────────────────┐
                      │       Dim_Date       │
                      │  date_id (PK)        │
                      │  day, month, quarter │
                      └──────────┬───────────┘
                                 │
     ┌──────────────────────┐    │    ┌──────────────────────┐
     │     Dim_Category     │    │    │       Dim_App        │
     │   category_id (PK)   ├────┼────┤     app_id (PK)      │
     │   domain_group       │    │    │     app_name, ver    │
     └──────────────────────┘    │    └──────────────────────┘
                                 │
                      ┌──────────┴───────────┐
                      │       FACT_APP       │
                      │  fact_id (PK)        │
                      │  ------------------- │
                      │  app_id (FK)         │
                      │  date_id (FK)        │
                      │  category_id (FK)    │
                      │  type_id (FK)        │
                      │  genre_id (FK)       │
                      │  content_rating (FK) │
                      │  android_ver (FK)    │
                      │  ------------------- │
                      │  rating              │
                      │  reviews_count       │
                      │  installs_count      │
                      │  price_usd           │
                      │  size_mb             │
                      │  sentiment_polarity  │
                      │  popularity_class    │
                      └──────────┬───────────┘
                                 │
     ┌──────────────────────┬────┴────┬──────────────────────┐
     │       Dim_Type       │         │      Dim_Genre       │
     │     type_id (PK)     │         │     genre_id (PK)    │
     └──────────────────────┘         └──────────────────────┘
                 │                                │
     ┌───────────┴──────────┐         ┌───────────┴──────────┐
     │  Dim_ContentRating   │         │  Dim_AndroidVersion  │
     │ content_rating_id(PK)│         │   android_ver_id(PK) │
     └──────────────────────┘         └──────────────────────┘
```

---

## 2. Table Specifications & Cardinalities

### 2.1 Central Fact Table: `fact_app`
- **Grain:** Exactly one record per distinct application entity.
- **Row Count:** 7,242 rows.
- **Integrity Status:** 0 orphan foreign keys; 100% referential integrity verified.

| Column | Role | Data Type | Constraint / Domain | Business Definition |
| :--- | :--- | :--- | :--- | :--- |
| `fact_id` | Primary Key | `INTEGER` | `PRIMARY KEY` | Unique surrogate key for each fact row. |
| `app_id` | Foreign Key | `INTEGER` | `REFERENCES dim_app(app_id)` | Link to application descriptor dimension. |
| `date_id` | Foreign Key | `INTEGER` | `REFERENCES dim_date(date_id)` | Link to release date temporal dimension. |
| `category_id` | Foreign Key | `INTEGER` | `REFERENCES dim_category(category_id)` | Link to classification category dimension. |
| `type_id` | Foreign Key | `INTEGER` | `REFERENCES dim_type(type_id)` | Link to commercial monetization dimension. |
| `genre_id` | Foreign Key | `INTEGER` | `REFERENCES dim_genre(genre_id)` | Link to genre classification dimension. |
| `content_rating_id` | Foreign Key | `INTEGER` | `REFERENCES dim_content_rating(content_rating_id)` | Link to target audience maturity tier. |
| `android_ver_id` | Foreign Key | `INTEGER` | `REFERENCES dim_android_version(android_ver_id)` | Link to OS platform compatibility. |
| `rating` | Measure | `NUMERIC(3,2)` | $[1.00, 5.00]$ (or `NULL`) | Average user rating. |
| `reviews_count` | Measure | `BIGINT` | $\ge 0$ | Total count of submitted reviews. |
| `installs_count` | Measure | `BIGINT` | $\ge 0$ | Verified lower bound of app installations. |
| `price_usd` | Measure | `NUMERIC(10,2)` | $\ge \$0.00$ | Unit price in US Dollars. |
| `size_mb` | Measure | `NUMERIC(8,2)` | $> 0.00$ (or `NULL`) | Application download payload in Megabytes. |
| `avg_sentiment_polarity` | Measure | `NUMERIC(4,3)` | $[-1.000, +1.000]$ | Aggregated mean user sentiment polarity. |
| `avg_sentiment_subjectivity` | Measure | `NUMERIC(4,3)` | $[0.000, 1.000]$ | Aggregated mean user sentiment subjectivity. |
| `total_review_records` | Measure | `INTEGER` | $\ge 0$ | Count of NLP-analyzed user review entries. |
| `popularity_class` | Mining Target | `INTEGER` | $\in \{0, 1, 2\}$ | Categorical target: 0 (Low), 1 (Med), 2 (High). |

---

### 2.2 Dimension Tables Summary
1. **`dim_app` (7,242 rows):** `app_id`, `app_name`, `current_ver`, `is_free`.
2. **`dim_date` (364 rows):** `date_id`, `full_date`, `day_num`, `month_num`, `month_name`, `quarter_num`, `year_num`, `day_of_week`.
3. **`dim_category` (33 rows):** `category_id`, `category_name`, `domain_group` (Gaming, Business & Finance, Social & Communication, Utilities & Tools, Family & Education, Lifestyle & Commerce, Media & Entertainment).
4. **`dim_type` (2 rows):** `type_id`, `type_name` (`Free`, `Paid`).
5. **`dim_genre` (111 rows):** `genre_id`, `genre_name`, `primary_genre`.
6. **`dim_content_rating` (5 rows):** `content_rating_id`, `rating_name`, `age_tier` (All Ages, Ages 10+, Teens (13+), Mature (17+), Adults (18+)).
7. **`dim_android_version` (30 rows):** `android_ver_id`, `raw_version`, `min_version`.

---

## 3. Database Portability Architecture
The database manager (`database/connection.py`) is designed with dynamic dialect abstraction:
- **Cloud Production (Vercel Serverless):** Connects to external PostgreSQL (Supabase / Neon) via `DATABASE_URL` with connection pooling.
- **Local Development / Offline Viva:** Connects automatically to embedded SQLite (`database/playstore_dwh.db`) without requiring internet access or active local database services.
