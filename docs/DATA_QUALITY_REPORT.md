# PlayStoreIQ — Data Quality & Profiling Audit Report

**Project:** Google Play Store Business Intelligence & Data Warehouse Mining System  
**Evaluation Standard:** Data Warehousing & Mining (DWM) Audit  
**Date:** October 2026  

---

## 1. Executive Summary
A comprehensive data quality audit was conducted on the source datasets: `googleplaystore.csv` (7,242 rows) and `googleplaystore_user_reviews.csv` (64,295 rows). The audit identified critical schema anomalies, missing values, column skew, and data type ambiguities that necessitate a canonical ETL pipeline before dimensional modeling or machine learning benchmarking can occur.

---

## 2. Dataset Profiling Metrics

### 2.1 Apps Dataset Summary (`googleplaystore.csv`)
- **Total Records:** 7,242
- **Total Attributes:** 14
- **Unique App Entities:** 7,242 (100% entity uniqueness at current snapshot)
- **Unique Categories:** 33 standard categories
- **Monetization Split:** 6,835 Free (94.38%), 406 Paid (5.61%), 1 Missing Type (0.01%)

#### Attribute Nullability & Quality Metrics:
| Attribute | Data Type | Null Count | Null % | Valid Range / Cardinality | Quality Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `App` | `VARCHAR` | 0 | 0.00% | 7,242 distinct strings | **VALID** |
| `Category` | `VARCHAR` | 0 | 0.00% | 33 distinct categories | **VALID** |
| `Rating` | `FLOAT` | 1,055 | 14.57% | $[1.00, 5.00]$ | **MISSING VALUES** (~14.6% nulls) |
| `Reviews` | `INTEGER` | 0 | 0.00% | $[0, 78,158,306]$ | **VALID** (High skew) |
| `Size` | `FLOAT (MB)`| 1,098 | 15.16% | $[0.008, 100.0]$ MB | **MISSING VALUES** (~15.2% nulls) |
| `Installs` | `BIGINT` | 0 | 0.00% | $[0, 1,000,000,000]$ | **VALID** (Discrete tiers) |
| `Type` | `VARCHAR` | 1 | 0.01% | Free / Paid | **1 ANOMALOUS NULL** |
| `Price` | `NUMERIC` | 0 | 0.00% | $[\$0.00, \$400.00]$ | **VALID** |
| `Content Rating`| `VARCHAR` | 0 | 0.00% | 5 distinct categories | **VALID** |
| `Genres` | `VARCHAR` | 0 | 0.00% | 114 genre combinations | **VALID** |
| `Last Updated` | `DATE` | 0 | 0.00% | Dates $2010$ to $2018$ | **VALID** |
| `Current Ver` | `VARCHAR` | 2 | 0.03% | Software versions | **MINOR NULLS** |
| `Android Ver` | `VARCHAR` | 2 | 0.03% | OS compatibility | **MINOR NULLS** |
| `IsFree` | `BOOLEAN` | 0 | 0.00% | True / False | **VALID** |

---

### 2.2 Distribution & Skewness Analysis

```
Metric Distributions & Statistical Properties:
─────────────────────────────────────────────────────────────────────────────
Install Count Distribution (Extreme Positive Skew: 13.07):
  • Min: 0
  • 25th Percentile: 10,000
  • Median: 100,000
  • 75th Percentile: 5,000,000
  • Max: 1,000,000,000
  • Installs < 10k: 2,108 apps (29.11%)
  • Installs 10k to 1M: 3,347 apps (46.22%)
  • Installs > 1M: 1,787 apps (24.68%)

Rating Distribution (Negative Skew: -1.88):
  • Valid Ratings: 6,187 apps
  • Min: 1.00 | Max: 5.00
  • Mean: 4.21 | Median: 4.30 | Std Dev: 0.52
  • Distribution peaks heavily in the [4.0, 4.6] interval.

Price Distribution:
  • Free Apps ($0.00): 6,836 (94.40%)
  • Paid Apps: 406 (5.60%)
  • Median Paid Price: $2.99
  • Mean Paid Price: $19.54 (skewed by niche medical apps and novelty '$400' apps)
```

---

### 2.3 User Reviews Profiling (`googleplaystore_user_reviews.csv`)
- **Total Records:** 64,295 rows
- **Null Reviews & Sentiments:** 26,863 rows (41.78% unreviewed / null rows)
- **Valid Sentiment Records:** 37,432 rows (58.22%)
- **Distinct Reviewed Apps:** 1,074 apps
- **Sentiment Breakdown:**
  - Positive: 23,998 (64.11%)
  - Negative: 8,271 (22.10%)
  - Neutral: 5,163 (13.79%)
- **Sentiment Polarity Range:** $[-1.000, +1.000]$ (Mean: $+0.182$, Median: $+0.150$, Std: $0.351$)

---

## 3. Discovered Anomalies & Resolution Strategy

### Anomaly 1: Column Shift / Malformed Row (Row 10472 in raw Kaggle)
- **Issue:** In uncleaned Kaggle datasets, row 10472 exhibits a missing `Category`, causing all downstream columns to shift left (e.g., `Category = "1.9"`, `Rating = 19.0`, `Price = "Everyone"`).
- **Resolution:** The ETL pipeline executes schema validation asserting `Category IN VALID_CATEGORIES` and `Rating <= 5.0`. Non-conforming rows are routed to the `etl_rejections` log and never committed to the database.

### Anomaly 2: Mixed Formatting in Size (`"14M"`, `"512k"`, `"Varies with device"`)
- **Issue:** Non-uniform units impede numeric analysis and SQL aggregation.
- **Resolution:** Deterministic parser converts Megabytes directly ($14.0$), Kilobytes divided by 1024 ($0.50$), and handles `"Varies with device"` by recording `NULL` in the warehouse measure while imputing the category median for ML modeling.

### Anomaly 3: Currency & Punctuation in Numeric Fields (`"$4.99"`, `"1,000,000+"`)
- **Issue:** Currency symbols and commas cause SQL type casting exceptions.
- **Resolution:** ETL regex sanitizer strips non-digit characters (preserving decimals) before committing as `NUMERIC(10,2)` and `BIGINT`.

### Anomaly 4: Missing Ratings (~14.57%) and Type Inconsistency
- **Issue:** 1,055 apps lack user ratings. Row 6072 has `Type = NULL` with `Price = 0.00`.
- **Resolution:** Missing `Type` is inferred deterministically: $\text{Type} = \text{'Free'}$ if $\text{Price} == 0$. For SQL OLAP measures, missing ratings remain `NULL` so as not to corrupt average rating calculations. For supervised model training, category-level median imputation is applied.

---

## 4. Preprocessing Reconciliation Contract
To guarantee consistency across Dashboard, SQL Warehouse, and Mining models:
$$\text{Source Rows} - \text{Rejected Rows} - \text{Duplicate Rows} = \text{Clean Rows} = \text{Warehouse Fact Rows}$$
- **Source Apps:** 7,242
- **ETL Rejections:** 0 (in current clean file)
- **Resolved Duplicates:** 0
- **Final Analytical & Warehouse Fact Rows:** 7,242
- **Audit Verification:** **PASSED (100% Reconciliation)**
