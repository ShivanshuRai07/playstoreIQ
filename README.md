# PlayStoreIQ: Data Warehousing & Data Mining System

PlayStoreIQ is an enterprise-grade **Data Warehousing & Business Intelligence (DWM) platform** built for Google Play Store market intelligence. It features a genuine **Star Schema Data Warehouse**, a **Relational OLAP (ROLAP) Engine**, **Leakage-Free 3-Tier Popularity Prediction**, unsupervised segment discovery, and an examiner-grade **Dual-Layer Architecture** (`[ 📊 Business Insight | ⚙️ How It Works ]`).

---

## 🌟 Key Architecture Pillars

```text
                                 PLAYSTOREIQ
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
              END USERS                               ADMIN
                    │                                   │
        ┌───────────┴──────────┐                   System Health
        │                      │                   ETL Invariants
   Normal User              Analyst                Warehouse Health
(Discovery Mode)       (Analytical Suite)          Model Registry
        │                      │                   Users & Security
        ↓                      ↓
    DISCOVERY             INVESTIGATION
        │                      │
        └──────────┬───────────┘
                   ↓
             INSIGHT LAYER
                   │
       ┌───────────┼───────────┐
       │           │           │
   ROLAP Cube  Supervised   Unsupervised
  (Roll-up,    Classifiers   Mining
   Drill-down, (6 Models,    (K-Means K=5,
   Slice, Dice, Champion     Apriori Rules,
   Pivot)       GBoost)      VADER Sentiment)
                   │
                   ↓
     HOW IT WORKS (TECHNICAL DWM)
                   │
      Exact SQL queries · Mathematical formulas ·
      Pipeline code · Viva defense explanations
```

---

## 👥 Role-Based Access Control (RBAC)

| Role | Default Email / Password | Scope & Modules |
|---|---|---|
| **Normal User** | `user@playstore.io` / `user` | **Discovery Mode:** Home overview, Trending with time windows (`7D`, `1M`, `3M`, `6M`, `1Y`), Category exploration, App insights. Clean view with zero raw ML clutter. |
| **Business Analyst** | `analyst@playstore.io` / `analyst` | **Full DWM Suite:** Market Intelligence, Category Opportunity Matrix (2x2 Quadrant), OLAP Engine (Roll-up, Drill-down, Slice, Dice, Pivot), Segmentation, Association Discovery, Sentiment Intelligence, Leakage-Free Popularity Prediction, and Model Benchmark. Every analytical module has the dual `[ Insights | ⚙️ How It Works ]` layer. |
| **Administrator** | `admin@playstore.io` / `admin` | **System Governance:** System Overview & reconciliation invariants, Canonical ETL audit & Live Fact Editor, Star Schema health & dimensional grain checks, Model Registry, User management, and Diagnostics. |

---

## 🏗️ Data Warehouse: Star Schema Specification

The warehouse (`database/playstore_dwh.db` / PostgreSQL) enforces strict referential integrity across 7,242 clean fact rows:

- **`fact_app`** (Grain: 1 unique app publishing record): `app_id`, `category_id`, `type_id`, `content_rating_id`, `date_id`, `rating`, `reviews`, `size_mb`, `installs`, `price_usd`
- **`dim_app`**: Surrogate app key, App name, Android version requirement
- **`dim_category`**: 33 conformed Google Play categories
- **`dim_type`**: Monetization type (`Free` vs `Paid`)
- **`dim_content_rating`**: Age gating classification (`Everyone`, `Teen`, `Mature 17+`, etc.)
- **`dim_date`**: Temporal calendar hierarchy (`date_key`, `year`, `quarter`, `month`, `day`, `day_of_week`)

### Canonical ETL Count Conservation Invariant
$$\text{Raw Ingestion } (10,841) - \text{Corrupt Rows } (1) - \text{Duplicate Snapshots } (3,598) = \text{Warehouse Clean Fact Rows } (7,242)$$

---

## 🤖 Machine Learning & Data Mining Modules

### 1. Zero-Leakage Popularity Prediction
* **Problem Formulation:** Multi-class classification into commercial market reach tiers:
  * **Low Popularity:** $< 10,000$ installs
  * **Medium Popularity:** $10,000 - 1,000,000$ installs
  * **High / Viral Reach:** $> 1,000,000$ installs
* **Zero-Leakage Guarantee:** `Installs` and `Reviews` are strictly excluded from the feature space.
* **Input Feature Space (Intrinsic Pre-Release Metadata):**
  $$\vec{x} = [\text{Price\_USD}, \text{Size\_MB}, \text{Android\_Min\_Ver}, \text{Name\_Length}, \text{Word\_Count}, \text{IsFree}, \text{Category\_Freq}, \text{ContentRating\_Freq}]$$

### 2. Six-Model Benchmark
Evaluated under 5-fold stratified cross-validation on 7,242 records:
1. **Gradient Boosting Classifier (Champion - Production):** Macro F1 = **55.76%**, ROC-AUC = **74.51%**
2. **Random Forest Classifier:** Macro F1 = 54.84%, ROC-AUC = 73.88%
3. **Decision Tree (CART):** Macro F1 = 53.69%, ROC-AUC = 65.58%
4. **K-Nearest Neighbors (KNN):** Macro F1 = 47.05%, ROC-AUC = 63.84%
5. **Logistic Regression:** Macro F1 = 46.87%, ROC-AUC = 64.33%
6. **Gaussian Naive Bayes:** Macro F1 = 43.90%, ROC-AUC = 63.18%

### 3. K-Means Market Segmentation ($K=5$)
* Features: $\vec{z} = [\ln(1+\text{Reviews}), \ln(1+\text{Installs}), \text{Rating}, \text{Price}, \text{Size\_MB}]$
* Evaluated over $K \in [2, 8]$; optimal silhouette score at $K=5$ ($0.4003$).
* Discovered clusters: *High-Engagement Leaders*, *Niche Free*, *Emerging Long-Tail*, *Premium Monetized*, *Heavyweight Mass Market*.

### 4. Apriori Association Rules
* Discovers frequent itemset associations with minimum support, confidence, and $\text{Lift} > 1.0$.
* Academic defense reminder: *Association does not imply causation*.

---

## ⚙️ Quickstart & Local Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Formal Verification Suite
```bash
python tests/test_dwm_verification.py
```
*Executes all 16 V&V integrity checks (ETL count conservation, Star Schema foreign keys, OLAP conservation, zero-leakage threshold, clustering silhouette, association lift).*

### 3. Start the Server
```bash
python backend/app.py
```
*Backend runs locally at: `http://127.0.0.1:5000`*

### 4. Access the Application
Open your browser to:
- **Login Portal:** `http://127.0.0.1:5000/login.html`
- **Analyst & User Workspace:** `http://127.0.0.1:5000/user.html`
- **System Administration:** `http://127.0.0.1:5000/admin.html`

---

## 📚 Viva Defense Reference

For in-depth viva questions, mathematical proofs, and examiner defense strategies, refer to:
- [`docs/EXAMINER_VIVA_DEFENSE.md`](docs/EXAMINER_VIVA_DEFENSE.md)
- [`reports/VERIFICATION_AND_VALIDATION_MATRIX.md`](reports/VERIFICATION_AND_VALIDATION_MATRIX.md)
- [`docs/STAR_SCHEMA_SPEC.md`](docs/STAR_SCHEMA_SPEC.md)
- [`docs/OLAP_OPERATIONS_CATALOG.md`](docs/OLAP_OPERATIONS_CATALOG.md)
- [`docs/MODEL_BENCHMARK_REPORT.md`](docs/MODEL_BENCHMARK_REPORT.md)
