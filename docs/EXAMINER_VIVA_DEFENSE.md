# PlayStoreIQ — DWM External Viva Defense & Examiner Guide

This document provides definitive, evidence-backed answers to core Data Warehousing and Data Mining (DWM) examination questions. It aligns directly with the **Dual-Layer Architecture** implemented in PlayStoreIQ (`[ Business Insight | ⚙️ How It Works ]`).

---

## 1. Architectural Integrity & Warehouse Design

### Q1: "Is this just Pandas running in memory, or a genuine Data Warehouse?"
> **Examiner Intent:** Verify whether the project satisfies dimensional modeling principles or is merely an in-memory CSV visualization.

**Viva Defense:**
* **True Star Schema Architecture:** All analytical queries operate against a normalized star schema stored in relational storage (`database/playstore_dwh.db` / PostgreSQL).
* **Fact Table:** `fact_app` at the grain of *one record per unique application publishing event* (7,242 rows after canonical deduplication and rejection).
* **Dimension Tables:** Five conformed dimensions connected via integer surrogate foreign keys:
  * `dim_app` (App identity, current Android minimum version, content rating)
  * `dim_category` (33 primary store categories)
  * `dim_type` (Monetization: Free vs. Paid)
  * `dim_content_rating` (Age gating: Everyone, Teen, Mature 17+, etc.)
  * `dim_date` (Calendar hierarchy: Year, Quarter, Month, Day, Day-of-Week)
* **Referential Integrity:** 100% verified via automated V&V test `V-DWH-02` (0 orphan records across all foreign key relationships).
* **Count Conservation Invariant:**
  $$\text{Raw Records } (10,841) - \text{Corrupt Rows } (1) - \text{Duplicate Snapshots } (3,598) = \text{Warehouse Clean Fact Rows } (7,242)$$

---

## 2. On-Line Analytical Processing (OLAP)

### Q2: "Demonstrate and explain the core OLAP operations in your system."
> **Examiner Intent:** Test formal understanding of multidimensional operations beyond basic chart generation.

**Viva Defense:**
PlayStoreIQ implements ROLAP (Relational OLAP) queries with exact SQL mappings exposed live in the UI's `[ ⚙️ How It Works ]` tab:

1. **Roll-up (Dimension Reduction / Aggregation):**
   * *Concept:* Moves from fine-grained data to higher-level summary concepts.
   * *Implementation:* Aggregates apps across categories up to global market totals.
   * *SQL Pattern:*
     ```sql
     SELECT c.category_name, COUNT(f.app_id) AS total_apps, SUM(f.installs) AS total_installs
     FROM fact_app f
     JOIN dim_category c ON f.category_id = c.category_id
     GROUP BY c.category_name;
     ```

2. **Drill-down (Dimension Addition / De-aggregation):**
   * *Concept:* Decomposes high-level summaries into granular sub-dimensions.
   * *Implementation:* Category $\rightarrow$ Content Rating or Genre distribution.
   * *SQL Pattern:*
     ```sql
     SELECT c.category_name, cr.content_rating_name, AVG(f.rating) AS avg_rating
     FROM fact_app f
     JOIN dim_category c ON f.category_id = c.category_id
     JOIN dim_content_rating cr ON f.content_rating_id = cr.content_rating_id
     GROUP BY c.category_name, cr.content_rating_name;
     ```

3. **Slice (Subsetting on Single Dimension):**
   * *Concept:* Fixes one specific dimension value while keeping all others variable.
   * *Implementation:* Filtering the entire warehouse exclusively for `dim_type.type_name = 'Paid'`.
   * *SQL Pattern:*
     ```sql
     SELECT c.category_name, COUNT(f.app_id) AS paid_apps
     FROM fact_app f
     JOIN dim_type t ON f.type_id = t.type_id
     JOIN dim_category c ON f.category_id = c.category_id
     WHERE t.type_name = 'Paid'
     GROUP BY c.category_name;
     ```

4. **Dice (Sub-cube Extraction on Multiple Dimensions):**
   * *Concept:* Defines a multi-dimensional bounding condition across two or more dimensions simultaneously.
   * *Implementation:* Restricting to `Category = 'GAME'`, `Type = 'Free'`, and `Rating >= 4.0`.
   * *SQL Pattern:*
     ```sql
     SELECT f.app_id, f.rating, f.installs
     FROM fact_app f
     JOIN dim_category c ON f.category_id = c.category_id
     JOIN dim_type t ON f.type_id = t.type_id
     WHERE c.category_name = 'GAME' AND t.type_name = 'Free' AND f.rating >= 4.0;
     ```

5. **Pivot (Axis Rotation / Cross-Tabulation):**
   * *Concept:* Rotates dimensional axes to display cross-tabulated tabular comparisons.
   * *Implementation:* Categories on vertical rows $\times$ Monetization Types on horizontal columns.
   * *SQL Pattern:*
     ```sql
     SELECT c.category_name,
            SUM(CASE WHEN t.type_name = 'Free' THEN f.installs ELSE 0 END) AS free_installs,
            SUM(CASE WHEN t.type_name = 'Paid' THEN f.installs ELSE 0 END) AS paid_installs
     FROM fact_app f
     JOIN dim_category c ON f.category_id = c.category_id
     JOIN dim_type t ON f.type_id = t.type_id
     GROUP BY c.category_name;
     ```

---

## 3. Machine Learning & Zero-Leakage Architecture

### Q3: "Why did you replace the old Rating Predictor with Popularity Tier Classification?"
> **Examiner Intent:** Probe dataset flaws, class imbalance, and genuine problem formulation.

**Viva Defense:**
* **Flaw of Rating Prediction:** In Google Play Store, user ratings are heavily skewed ($82\%$ of ratings are $>4.0$, median $4.3$). Binary thresholding at $\ge 4.3$ creates artificial boundaries without actionable business utility.
* **Flaw of Target Leakage in Naive Models:** Using `Installs` and `Reviews` to predict rating or popularity is an egregious data leakage bug—an app with $10\text{M}$ installs and $500\text{K}$ reviews has already achieved market success.
* **The Remediated Problem Definition:** We predict **Commercial Popularity Tier** at publishing time using only **8 intrinsic metadata features** known *before* the app launches:
  $$\vec{x} = [\text{Price\_USD}, \text{Size\_MB}, \text{Android\_Min\_Ver}, \text{Name\_Length}, \text{Word\_Count}, \text{IsFree}, \text{Category\_Freq}, \text{ContentRating\_Freq}]$$
* **Target Classes:**
  * **Low Popularity:** $< 10,000$ installs
  * **Medium Popularity:** $10,000 - 1,000,000$ installs
  * **High / Viral Popularity:** $> 1,000,000$ installs
* **Zero Leakage Guarantee:** `Installs` and `Reviews` are strictly excluded from the feature space.

### Q4: "Why do you benchmark six algorithms instead of just picking one?"
> **Examiner Intent:** Verify comparative evaluation methodology and understanding of model inductive biases.

**Viva Defense:**
We evaluated 6 diverse machine learning families under identical 5-fold stratified cross-validation on 7,242 samples:

| Model Family | Algorithm | Macro F1 | ROC-AUC | Status | Why Evaluated? |
|---|---|---:|---:|---|---|
| **Ensemble (Boosting)** | Gradient Boosting | **55.76%** | **74.51%** | **Champion (Inference)** | Sequentially corrects residual pseudo-errors; handles non-linear interactions best |
| **Ensemble (Bagging)** | Random Forest | 54.84% | 73.88% | Evaluated | Reduces variance across decorrelated decision trees |
| **Non-Parametric Tree** | Decision Tree (CART) | 53.69% | 65.58% | Evaluated | Interpretable axis-parallel orthogonal decision boundaries |
| **Instance-Based** | K-Nearest Neighbors | 47.05% | 63.84% | Evaluated | Local topological manifold distance in scaled feature space |
| **Linear / Generalized Linear** | Logistic Regression | 46.87% | 64.33% | Evaluated | Baseline linear hyperplane separator with softmax probabilities |
| **Probabilistic Generative** | Gaussian Naive Bayes | 43.90% | 63.18% | Evaluated | Conditional independence assumption fails due to correlated metadata |

* **Selection Rationale:** Gradient Boosting achieved the highest Macro F1 ($55.76\%$) and highest ROC-AUC ($74.51\%$), proving superior handling of asymmetric market distribution.

---

## 4. Unsupervised Data Mining: Clustering & Association

### Q5: "How did you determine $K=5$ in K-Means clustering?"
> **Examiner Intent:** Detect arbitrary parameter guessing vs. mathematical validation.

**Viva Defense:**
* **Feature Space:** To prevent distortion by extreme power-law distributions, feature representations undergo logarithmic normalization:
  $$\vec{z} = [\ln(1 + \text{Reviews}), \ln(1 + \text{Installs}), \text{Rating}, \text{Price}, \text{Size\_MB}]$$
  followed by Z-score standardization ($\mu=0, \sigma=1$).
* **Hyperparameter Selection:** Systematic grid search tested $K \in [2, 8]$:
  * $K=2$: Silhouette = 0.312 (Under-segmented)
  * $K=3$: Silhouette = 0.354
  * $K=4$: Silhouette = 0.381
  * **$K=5$: Silhouette = 0.4003 (Optimal local maximum with coherent segment separation)**
  * $K=6$: Silhouette = 0.372 (Over-fragmentation)
* **Business Segment Interpretations:**
  * **Cluster 0:** *High-Engagement Leaders* (Very high installs & reviews, strong rating)
  * **Cluster 1:** *Niche Free Apps* (Moderate installs, standard sizes, zero price)
  * **Cluster 2:** *Emerging / Long-Tail* (Low installs, low review volume, varying ratings)
  * **Cluster 3:** *Premium Monetized* (Price $>0$, lower installs, focused audience)
  * **Cluster 4:** *Heavyweight Mass Market* (Large APK size $>50\text{MB}$, high installs)

### Q6: "Does an Apriori association rule imply that category causes installs?"
> **Examiner Intent:** Classic DWM trap: Association vs. Causation.

**Viva Defense:**
* **Crucial Answer:** **"No. Association does not imply causation."**
* Association rules identify statistical co-occurrence within transactional discretized baskets:
  $$\text{Support}(A \Rightarrow B) = P(A \cap B), \quad \text{Confidence}(A \Rightarrow B) = P(B \mid A), \quad \text{Lift}(A \Rightarrow B) = \frac{P(A \cap B)}{P(A) \cdot P(B)}$$
* A rule such as $\{\text{Type=Free}, \text{Content=Everyone}\} \Rightarrow \{\text{Installs=High}\}$ with $\text{Lift} = 1.42$ indicates that free, universally rated apps achieve high install tiers **$42\%$ more often than expected under statistical independence**. It does not prove that making an app free guarantees high installs.

---

## 5. Role-Based Access Control (RBAC) & Governance

### Q7: "How is governance enforced across user types?"
> **Examiner Intent:** Verify security and operational usability.

**Viva Defense:**
The system enforces strict 3-tier Role-Based Access Control verified via stateless cryptographically signed JWT tokens:

| Role | Access Scope | Intended Workflow |
|---|---|---|
| **Normal User** (`user@playstore.io`) | Discovery Only | Home, Trending with time windows (7D, 1M, 3M, 6M, 1Y), Category browsing, App insights. **Zero raw ML metrics exposed.** |
| **Business Analyst** (`analyst@playstore.io`) | Full DWM Analytical Suite | Market Intelligence, 2x2 Opportunity Matrix, OLAP Engine, Segmentation, Association, Sentiment, Popularity Predictor, Model Benchmark. Every screen contains the dual **`[ Business Insight | ⚙️ How It Works ]`** layer. |
| **System Administrator** (`admin@playstore.io`) | DWH & Pipeline Governance | System Overview, Data & ETL canonical audits, Live Fact Editor, Star Schema integrity, Model Registry, User Management, Diagnostics. |

---

## 6. Formal Verification & Validation (V&V) Matrix

| Test ID | Domain | Invariant / Property Checked | Result |
|---|---|---|---|
| **V-ETL-01** | ETL Pipeline | Count Conservation: $10,841 - 1 - 3,598 = 7,242$ | **PASS** |
| **V-ETL-02** | Data Cleaning | Rating Bounds $[1.0, 5.0]$ | **PASS** |
| **V-ETL-03** | Data Cleaning | Free apps have Price $= 0.0$ | **PASS** |
| **V-ETL-04** | Feature Eng. | 3-tier Popularity non-degenerate distribution | **PASS** |
| **V-DWH-01** | Star Schema | Fact table cardinality matches clean record count | **PASS** |
| **V-DWH-02** | Star Schema | Zero orphan foreign keys across all 5 dimensions | **PASS** |
| **V-DWH-03** | Star Schema | Dimension primary entity uniqueness | **PASS** |
| **V-OLAP-01** | OLAP Engine | Roll-up measure conservation ($72,364,556,687$ installs) | **PASS** |
| **V-OLAP-02** | OLAP Engine | Slice correctness on monetization dimension | **PASS** |
| **V-OLAP-03** | OLAP Engine | Pivot cross-tab sum conservation | **PASS** |
| **V-ML-01** | Classification | Stratified test split sample conservation ($1,449$) | **PASS** |
| **V-ML-02** | Classification | Leakage-free Macro F1 $\ge 0.50$ ($55.76\%$) | **PASS** |
| **V-ML-03** | Inference | Real-time inference latency $< 50\text{ms}$ & valid tier | **PASS** |
| **V-CLU-01** | Clustering | Silhouette evaluation peaks at $K=5$ ($0.4003$) | **PASS** |
| **V-CLU-02** | Clustering | Cluster partition conservation ($7,242$ items) | **PASS** |
| **V-APR-01** | Association | Statistical dependency: all published rules have $\text{Lift} > 1.0$ | **PASS** |
