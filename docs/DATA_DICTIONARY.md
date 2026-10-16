# PlayStoreIQ — Data Dictionary

**Project:** Google Play Store Business Intelligence & Data Warehouse Mining System  
**Version:** 2.0 (DWM Specification)  
**Date:** October 2026  

---

## 1. Overview
This data dictionary specifies the schema, definitions, storage types, business logic, constraints, and transformations for the Google Play Store analytical dataset. It governs the transition from raw CSV source data into the dimensional Star Schema warehouse.

---

## 2. Apps Dataset (`googleplaystore.csv`)

| Column Name | Raw Type | Target SQL Type | Nullable | Primary Domain / Valid Values | Description & Transformation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `App` | `VARCHAR` | `VARCHAR(255)` | **NO** | String (1 to 255 chars) | Canonical application name. Stripped of extra spaces and non-printable characters. Used to populate `Dim_App`. |
| `Category` | `VARCHAR` | `VARCHAR(64)` | **NO** | 33 canonical categories (e.g., `ART_AND_DESIGN`, `GAME`, `FAMILY`) | App store classification category. Anomaly `"1.9"` rejected during ETL validation. Mapped to `Dim_Category`. |
| `Rating` | `FLOAT` | `NUMERIC(3,2)` | **YES** | $[1.00, 5.00]$ | Average user rating out of 5 stars. Values $> 5.0$ are invalid and rejected. Missing ratings preserved as `NULL` in measures, median imputed for models. |
| `Reviews` | `VARCHAR` / `INT` | `BIGINT` | **NO** | $\ge 0$ | Total number of user reviews. Strings stripped of commas/characters and cast to 64-bit integer. |
| `Size` | `VARCHAR` | `NUMERIC(8,2)` | **YES** | $> 0.0$ (in Megabytes) | App installation package size in MB. Normalized from suffixes (`"14M"` $\to 14.0$, `"512k"` $\to 0.50$). `"Varies with device"` handled via category median imputation. |
| `Installs` | `VARCHAR` | `BIGINT` | **NO** | $\ge 0$ (e.g., $10^3, 10^4, 10^6$) | Lower bound of install count. Stripped of commas and plus signs (`"1,000,000+"` $\to 1000000$). Primary metric for popularity classification. |
| `Type` | `VARCHAR` | `VARCHAR(16)` | **NO** | `{'Free', 'Paid'}` | Commercial distribution model. Nulls or non-standard values resolved using `Price`: if `Price == 0` then `Free`, else `Paid`. Mapped to `Dim_Type`. |
| `Price` | `VARCHAR` | `NUMERIC(10,2)` | **NO** | $\ge 0.00$ (in USD) | Purchase price in US Dollars. Stripped of currency symbols (`"$4.99"` $\to 4.99$). Free apps set to $0.00$. |
| `Content Rating` | `VARCHAR` | `VARCHAR(32)` | **NO** | `{'Everyone', 'Teen', 'Mature 17+', 'Everyone 10+', 'Adults only 18+', 'Unrated'}` | Age maturity appropriateness certification. Mapped to `Dim_ContentRating`. |
| `Genres` | `VARCHAR` | `VARCHAR(128)` | **NO** | Semicolon-delimited strings (e.g. `Art & Design;Pretend Play`) | Sub-genre classifications. Primary genre extracted for `Dim_Genre`. |
| `Last Updated` | `VARCHAR` | `DATE` | **NO** | Valid ISO 8601 Date (`YYYY-MM-DD`) | Date of most recent app release on the store. Parsed from textual dates (e.g. `"January 7, 2018"` $\to `2018-01-07`$). Mapped to `Dim_Date`. |
| `Current Ver` | `VARCHAR` | `VARCHAR(64)` | **YES** | String version identifier | Developer's software release version string. Nulls defaulted to `'Unknown'`. |
| `Android Ver` | `VARCHAR` | `VARCHAR(64)` | **YES** | Minimum OS requirement (e.g. `'4.1 and up'`, `'Varies with device'`) | Minimum Android operating system version required to execute app. Parsed into `Dim_AndroidVersion`. |

---

## 3. User Reviews Dataset (`googleplaystore_user_reviews.csv`)

| Column Name | Raw Type | Target SQL Type | Nullable | Primary Domain / Valid Values | Description & Aggregation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `App` | `VARCHAR` | `VARCHAR(255)` | **NO** | Matching `Dim_App.app_name` | Foreign key reference connecting review records to specific apps. |
| `Translated_Review` | `TEXT` | `TEXT` | **YES** | Cleaned natural language text | English translation of raw review text. Empty or null reviews filtered out of sentiment analytics. |
| `Sentiment` | `VARCHAR` | `VARCHAR(16)` | **YES** | `{'Positive', 'Negative', 'Neutral'}` | Categorical sentiment label evaluated by NLP model. |
| `Sentiment_Polarity` | `FLOAT` | `NUMERIC(4,3)` | **YES** | $[-1.000, +1.000]$ | Continuous polarity score: $-1.0$ (strongly negative) to $+1.0$ (strongly positive). Aggregated per app into warehouse measure `avg_sentiment_polarity`. |
| `Sentiment_Subjectivity` | `FLOAT` | `NUMERIC(4,3)` | **YES** | $[0.000, 1.000]$ | Continuous subjectivity score: $0.0$ (completely objective) to $1.0$ (completely subjective). Aggregated per app into `avg_sentiment_subjectivity`. |

---

## 4. Derived Measures & Dimensional Hierarchy

### 4.1 Concept Hierarchies for OLAP
```
[Temporal Hierarchy]
Year (e.g., 2018) 
  └── Quarter (Q1, Q2, Q3, Q4)
        └── Month (01 to 12)
              └── Day (YYYY-MM-DD)

[Categorical Hierarchy]
Domain Group (e.g., Gaming, Productivity, Lifestyle)
  └── Category (e.g., GAME_ACTION, PRODUCTIVITY)
        └── Primary Genre (e.g., Action, Office)
              └── App (Specific Software Package)
```

### 4.2 Derived Mining Target Variables
- `Popularity_Class` (Categorical Target $\in \{0, 1, 2\}$):
  - **Class 0 (Low):** $\text{Installs} < 10,000$
  - **Class 1 (Medium):** $10,000 \le \text{Installs} \le 1,000,000$
  - **Class 2 (High / Viral):** $\text{Installs} > 1,000,000$
- `IsFree` (Boolean Indicator):
  - $\text{IsFree} = \begin{cases} \text{TRUE} & \text{if } \text{Type} = 'Free' \lor \text{Price} = 0.00 \\ \text{FALSE} & \text{otherwise} \end{cases}$
