# PlayStoreIQ — Analytical Problem Formulation & Leakage Prevention

**Project:** Google Play Store Business Intelligence & Data Warehouse Mining System  
**Evaluation Standard:** Academic DWM Problem Formulation  
**Date:** October 2026  

---

## 1. Problem Formulation Overview
Before engineering machine learning models or unsupervised algorithms, the analytical objectives must be formally defined with explicit boundary conditions, feature boundaries, and mathematical proofs preventing **data leakage**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PLAY STORE ANALYTICAL MINING SUITE                    │
├───────────────────────────────┬─────────────────────────────┬───────────────┤
│    1. SUPERVISED CLASSIFIER   │  2. UNSUPERVISED CLUSTERING │  3. APRIORI   │
│  Early-Stage Popularity Tier  │  Market Segmentation (K-Means) Market Basket│
└───────────────────────────────┴─────────────────────────────┴───────────────┘
```

---

## 2. Supervised Learning: Early-Stage Popularity Tier Classification

### 2.1 The Architectural Flaw in the Baseline Setup
In the initial prototype, the classification task was configured as:
- **Baseline Target:** $Y = \mathbb{I}(\text{Rating} \ge 4.3)$ (Arbitrary binary threshold)
- **Baseline Features:** $X = [\log(1 + \text{Installs}), \log(1 + \text{Reviews}), \text{Size}, \text{Price}, \text{IsFree}]$

#### Proof of Data Leakage in Baseline:
1. **Target Leakage / Circularity:** In app ecosystems, user ratings and the volume of user reviews are consequences of prolonged market presence. The volume of user reviews is a direct downstream artifact of the app having been installed and rated by millions of users:
   $$\text{Reviews} \propto \text{Installs} \times P(\text{Review} \mid \text{Install})$$
2. **Impractical Inference:** An app developer cannot provide the number of reviews or installs prior to deploying their application. Using accumulated reviews to predict ratings or popularity solves an artificial, post-hoc problem rather than an actionable predictive task.

### 2.2 Formalized Task: Early-Stage App Popularity Classification
We formulate the problem as **Early-Stage Market Viability / Popularity Tier Classification**: predicting the tier of market reach an app will achieve based solely on **pre-launch, intrinsic software characteristics**.

#### Target Variable ($Y \in \{0, 1, 2\}$):
$$\text{Popularity\_Class} = \begin{cases} 
0 \text{ (Low Reach)}, & \text{if } \text{Installs} < 10,000 \\ 
1 \text{ (Medium Reach)}, & \text{if } 10,000 \le \text{Installs} \le 1,000,000 \\ 
2 \text{ (High / Viral Reach)}, & \text{if } \text{Installs} > 1,000,000 
\end{cases}$$

**Empirical Class Distribution (from Data Quality Audit):**
- **Class 0 (Low):** 2,108 apps ($29.11\%$)
- **Class 1 (Medium):** 3,347 apps ($46.22\%$)
- **Class 2 (High):** 1,787 apps ($24.68\%$)
*Result: A balanced, non-degenerate 3-class distribution.*

#### Feature Matrix ($X \in \mathbb{R}^{N \times d}$):
Only intrinsic attributes available at or before publication are admitted:
1. `Category` (Categorical, Target / Frequency / One-Hot encoded)
2. `Content_Rating` (Categorical, Ordinal encoded)
3. `Type` (Binary: 0 = Free, 1 = Paid)
4. `Price_USD` (Continuous, Scaled)
5. `Size_MB` (Continuous, Category-median imputed and Scaled)
6. `Android_Ver_Min` (Continuous numeric OS version or Categorical tier)
7. `App_Name_Length` (Discrete character count)
8. `App_Name_Word_Count` (Discrete word count)

#### Explicitly Excluded Features:
- `Installs`: Directly used to derive the target variable $Y$. Including it would cause perfect collinearity ($R^2 \approx 1.0$) and 100% trivial leakage.
- `Reviews`: Downstream consequence of market traction ($r_{\text{Reviews}, \text{Installs}} = 0.63$). Excluded to preserve pre-launch validity.
- `Rating`: Post-launch user feedback metric. Excluded from early-stage predictor features.

---

## 3. Unsupervised Learning: Market App Profiling (K-Means)

### 3.1 Objective
Partition the multi-dimensional application landscape into $K$ cohesive, non-overlapping clusters without imposing human bias or predefined cluster meanings.

### 3.2 Feature Vector
Standardized continuous analytical attributes:
$$\vec{z} = \left[ \log(1 + \text{Installs}), \log(1 + \text{Reviews}), \text{Rating}, \text{Price}, \text{Size\_MB} \right] \in \mathbb{R}^5$$

### 3.3 Mathematical Optimization
Given a dataset $D = \{\vec{z}_1, \vec{z}_2, \dots, \vec{z}_N\}$, minimize the Within-Cluster Sum of Squares (Inertia):
$$J(C_1, \dots, C_K) = \sum_{k=1}^{K} \sum_{\vec{z}_i \in C_k} \|\vec{z}_i - \vec{\mu}_k\|_2^2$$
where $\vec{\mu}_k = \frac{1}{|C_k|} \sum_{\vec{z}_i \in C_k} \vec{z}_i$.

### 3.4 Criteria for Optimal $K$
1. **Elbow Method:** Identify the inflection point where the rate of decrease of inertia $\Delta J_K$ sharply diminishes.
2. **Silhouette Coefficient:** For each sample $i$, compute:
   $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$$
   where $a(i)$ is mean intra-cluster distance and $b(i)$ is mean nearest-cluster distance.
   Select $K^* = \arg\max_K \bar{s}(K)$ across $K \in [2, 8]$.

---

## 4. Association Rule Mining: Attribute Co-occurrence (Apriori)

### 4.1 Objective
Discover statistically significant, actionable relationship rules of the form $A \implies B$ among app attributes.

### 4.2 Discretization & Transaction Encoding
Each application record is mapped to a transaction itemset $T_i$:
- `Category` $\in \{\text{GAME}, \text{FAMILY}, \text{TOOLS}, \dots\}$
- `Type` $\in \{\text{Type=Free}, \text{Type=Paid}\}$
- `Content_Rating` $\in \{\text{Content=Everyone}, \text{Content=Teen}, \dots\}$
- `Rating_Tier` $\in \{\text{Rating: Below 4.0}, \text{Rating: 4.0-4.4}, \text{Rating: 4.5-5.0}\}$
- `Install_Tier` $\in \{\text{Installs: <10k}, \text{Installs: 10k-1M}, \text{Installs: >1M}\}$

### 4.3 Mining Thresholds
1. **Support:** Minimum itemset prevalence:
   $$\text{Support}(A \implies B) = \frac{|T : A \cup B \subseteq T|}{|D|} \ge \text{min\_sup} = 0.04$$
2. **Confidence:** Conditional probability of consequent given antecedent:
   $$\text{Confidence}(A \implies B) = \frac{\text{Support}(A \cup B)}{\text{Support}(A)} \ge \text{min\_conf} = 0.50$$
3. **Lift:** Degree of statistical dependency beyond chance:
   $$\text{Lift}(A \implies B) = \frac{\text{Confidence}(A \implies B)}{\text{Support}(B)} > 1.20$$
   *Rules with $\text{Lift} \le 1.0$ indicate independent or negatively correlated associations and are strictly discarded.*
