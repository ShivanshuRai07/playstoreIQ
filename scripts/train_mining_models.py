"""
PlayStoreIQ — Machine Learning & Data Mining Benchmarking Engine
Performs offline training, validation, and benchmarking for:
1. 5A: Six Supervised Classifiers (Random Forest, Gradient Boosting, Logistic Regression,
       Decision Tree, KNN, Naive Bayes) with 5-Fold Stratified CV, zero data leakage,
       and full metric suites (Accuracy, Precision, Recall, F1, ROC-AUC, Confusion Matrices).
2. 5B: Unsupervised K-Means Clustering across K in [2, 8] with Elbow and Silhouette curves,
       optimal K selection, and empirical cluster profiling.
3. 5C: Real Apriori Association Rule Mining on binned transactional attributes with
       Support, Confidence, and Lift calculations.

Saves all serialized artifacts to models/artifacts/ for fast, Vercel-safe serverless inference.
"""
import os
import time
import json
import joblib
import itertools
import numpy as np
import pandas as pd
from collections import defaultdict

from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

RANDOM_SEED = 42

def train_classifiers(df, artifacts_dir):
    print("\n[MINING 5A] Training & Benchmarking 6 Classifiers...")
    
    # 1. Feature Engineering (Strictly intrinsic metadata to prevent leakage)
    feature_cols = [
        "Price_USD", "size_imputed_mb", "Android_Min_Ver",
        "app_name_len", "app_name_words", "IsFree_int"
    ]
    df["IsFree_int"] = df["IsFree"].astype(int)

    # Encode Categoricals: Category & Content Rating via frequency encoding (leak-proof)
    cat_freq = df["Category"].value_counts(normalize=True).to_dict()
    cr_freq = df["Content_Rating"].value_counts(normalize=True).to_dict()
    df["category_freq"] = df["Category"].map(cat_freq)
    df["content_rating_freq"] = df["Content_Rating"].map(cr_freq)

    feature_cols.extend(["category_freq", "content_rating_freq"])

    X = df[feature_cols].values
    y = df["popularity_class"].values

    # Stratified Train/Test split: 80% Train, 20% untouched Test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_SEED, stratify=y
    )

    # Fit scaler strictly on training split
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Candidate Models Suite
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=12, random_state=RANDOM_SEED),
        "Gradient Boosting": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=RANDOM_SEED),
        "Logistic Regression": LogisticRegression(max_iter=500, random_state=RANDOM_SEED),
        "Decision Tree": DecisionTreeClassifier(max_depth=10, random_state=RANDOM_SEED),
        "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=7),
        "Naive Bayes": GaussianNB()
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    benchmark_results = []
    confusion_matrices = {}
    trained_estimators = {}

    for name, clf in models.items():
        print(f"  -> Benchmarking {name} with 5-Fold Stratified CV...")
        start_time = time.time()
        
        cv_accuracies, cv_f1_macros = [], []
        for train_idx, val_idx in cv.split(X_train_scaled, y_train):
            X_cv_train, X_cv_val = X_train_scaled[train_idx], X_train_scaled[val_idx]
            y_cv_train, y_cv_val = y_train[train_idx], y_train[val_idx]
            clf.fit(X_cv_train, y_cv_train)
            val_preds = clf.predict(X_cv_val)
            cv_accuracies.append(accuracy_score(y_cv_val, val_preds))
            cv_f1_macros.append(f1_score(y_cv_val, val_preds, average="macro"))

        # Fit on full training set
        clf.fit(X_train_scaled, y_train)
        train_time_ms = round((time.time() - start_time) * 1000, 2)

        # Evaluate on untouched Test set
        infer_start = time.time()
        y_pred = clf.predict(X_test_scaled)
        infer_time_ms = round((time.time() - infer_start) * 1000, 2)

        # Probabilities for ROC-AUC
        try:
            y_proba = clf.predict_proba(X_test_scaled)
            roc_auc = round(float(roc_auc_score(y_test, y_proba, multi_class="ovr")), 4)
        except Exception:
            roc_auc = None

        acc = round(float(accuracy_score(y_test, y_pred)), 4)
        prec_macro = round(float(precision_score(y_test, y_pred, average="macro", zero_division=0)), 4)
        rec_macro = round(float(recall_score(y_test, y_pred, average="macro", zero_division=0)), 4)
        f1_macro = round(float(f1_score(y_test, y_pred, average="macro", zero_division=0)), 4)
        f1_weighted = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4)

        cm = confusion_matrix(y_test, y_pred).tolist()
        confusion_matrices[name] = cm
        trained_estimators[name] = clf

        benchmark_results.append({
            "model_name": name,
            "cv_accuracy_mean": round(float(np.mean(cv_accuracies)), 4),
            "cv_accuracy_std": round(float(np.std(cv_accuracies)), 4),
            "cv_f1_macro_mean": round(float(np.mean(cv_f1_macros)), 4),
            "test_accuracy": acc,
            "test_precision_macro": prec_macro,
            "test_recall_macro": rec_macro,
            "test_f1_macro": f1_macro,
            "test_f1_weighted": f1_weighted,
            "roc_auc_ovr": roc_auc,
            "train_time_ms": train_time_ms,
            "inference_time_ms": infer_time_ms
        })

    # Sort leaderboard by Macro F1
    benchmark_results.sort(key=lambda x: x["test_f1_macro"], reverse=True)
    best_model_name = benchmark_results[0]["model_name"]
    print(f"[MINING 5A] Completed benchmark. Best model: {best_model_name} (Macro F1: {benchmark_results[0]['test_f1_macro']})")

    # Save artifacts
    joblib.dump(trained_estimators, os.path.join(artifacts_dir, "classifier_models.joblib"))
    joblib.dump({
        "scaler": scaler,
        "feature_cols": feature_cols,
        "cat_freq": cat_freq,
        "cr_freq": cr_freq
    }, os.path.join(artifacts_dir, "scaler_encoder.joblib"))

    with open(os.path.join(artifacts_dir, "model_comparison_metrics.json"), "w", encoding="utf-8") as f:
        json.dump({
            "best_model": best_model_name,
            "evaluation_criterion": "Macro F1-Score on untouched test set",
            "test_samples_count": len(y_test),
            "train_samples_count": len(y_train),
            "leaderboard": benchmark_results
        }, f, indent=2)

    with open(os.path.join(artifacts_dir, "confusion_matrices.json"), "w", encoding="utf-8") as f:
        json.dump(confusion_matrices, f, indent=2)

    return benchmark_results, best_model_name


def run_clustering(df, artifacts_dir):
    print("\n[MINING 5B] Running K-Means Clustering & Elbow/Silhouette Evaluation...")
    # Features for segmentation: Reviews (log), Installs (log), Rating, Price, Size
    clustering_df = df.copy()
    clustering_df["LogInstalls"] = np.log1p(clustering_df["Installs_Count"])
    clustering_df["LogReviews"] = np.log1p(clustering_df["Reviews_Count"])
    rating_median = clustering_df["Rating_Score"].median() or 4.3
    clustering_df["Rating_Filled"] = clustering_df["Rating_Score"].fillna(rating_median)

    feat_names = ["LogInstalls", "LogReviews", "Rating_Filled", "Price_USD", "size_imputed_mb"]
    X = clustering_df[feat_names].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    k_range = list(range(2, 9))
    elbow_inertia = []
    silhouette_scores = []
    models_by_k = {}

    for k in k_range:
        km = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init=10)
        labels = km.fit_predict(X_scaled)
        elbow_inertia.append(round(float(km.inertia_), 2))
        sil = round(float(silhouette_score(X_scaled, labels)), 4)
        silhouette_scores.append(sil)
        models_by_k[k] = (km, labels)
        print(f"  -> K = {k}: Inertia = {elbow_inertia[-1]}, Silhouette = {sil}")

    # Optimal K has highest silhouette score
    optimal_idx = int(np.argmax(silhouette_scores))
    optimal_k = k_range[optimal_idx]
    best_km, best_labels = models_by_k[optimal_k]
    print(f"[MINING 5B] Optimal K selected: {optimal_k} (Silhouette: {silhouette_scores[optimal_idx]})")

    # Empirical Cluster Profiling
    clustering_df["Cluster"] = best_labels
    cluster_profiles = []
    for c_id in range(optimal_k):
        c_sub = clustering_df[clustering_df["Cluster"] == c_id]
        profile = {
            "cluster_id": int(c_id),
            "size": int(len(c_sub)),
            "percentage": round(float(len(c_sub) / len(clustering_df) * 100), 1),
            "avg_installs": int(c_sub["Installs_Count"].median()),
            "avg_reviews": int(c_sub["Reviews_Count"].median()),
            "avg_rating": round(float(c_sub["Rating_Filled"].mean()), 2),
            "avg_price": round(float(c_sub["Price_USD"].mean()), 2),
            "avg_size_mb": round(float(c_sub["size_imputed_mb"].mean()), 1),
            "free_percentage": round(float((c_sub["Price_USD"] == 0).mean() * 100), 1),
            "top_categories": c_sub["Category"].value_counts().head(3).to_dict()
        }
        cluster_profiles.append(profile)

    # Save artifacts
    joblib.dump({"model": best_km, "scaler": scaler, "features": feat_names}, os.path.join(artifacts_dir, "clustering_kmeans.joblib"))

    with open(os.path.join(artifacts_dir, "clustering_results.json"), "w", encoding="utf-8") as f:
        json.dump({
            "optimal_k": optimal_k,
            "k_range": k_range,
            "elbow_curve": [{"k": k, "inertia": in_val} for k, in_val in zip(k_range, elbow_inertia)],
            "silhouette_curve": [{"k": k, "score": s_val} for k, s_val in zip(k_range, silhouette_scores)],
            "cluster_profiles": cluster_profiles
        }, f, indent=2)

    return optimal_k, cluster_profiles


def run_apriori_association(df, artifacts_dir, min_support=0.04, min_confidence=0.50, min_lift=1.20):
    print("\n[MINING 5C] Mining Association Rules using Real Apriori Engine...")
    
    # Discretize continuous attributes into categorical market basket items
    transactions = []
    for _, row in df.iterrows():
        items = set()
        items.add(f"Category={row['Category']}")
        items.add(f"Type={row['Type']}")
        items.add(f"Audience={row['Content_Rating']}")
        
        # Rating bin
        r = row.get("Rating_Score")
        if pd.isna(r):
            items.add("Rating=Unrated")
        elif r < 4.0:
            items.add("Rating=<4.0")
        elif r <= 4.4:
            items.add("Rating=4.0-4.4")
        else:
            items.add("Rating=4.5-5.0")

        # Install tier
        inst = row.get("Installs_Count", 0)
        if inst < 10000:
            items.add("Installs=<10k")
        elif inst <= 1000000:
            items.add("Installs=10k-1M")
        else:
            items.add("Installs=>1M")

        transactions.append(items)

    n_trans = len(transactions)
    print(f"  -> Encoded {n_trans} transactions. Mining frequent 1-itemsets...")

    # Frequent 1-itemsets
    item_counts = defaultdict(int)
    for t in transactions:
        for item in t:
            item_counts[item] += 1

    freq_1 = {frozenset([k]): v / n_trans for k, v in item_counts.items() if (v / n_trans) >= min_support}
    print(f"  -> Frequent 1-itemsets count: {len(freq_1)}")

    # Frequent 2-itemsets
    pair_counts = defaultdict(int)
    items_1 = [list(x)[0] for x in freq_1.keys()]
    for t in transactions:
        valid_items = [i for i in t if i in items_1]
        for pair in itertools.combinations(sorted(valid_items), 2):
            pair_counts[pair] += 1

    freq_2 = {frozenset(k): v / n_trans for k, v in pair_counts.items() if (v / n_trans) >= min_support}
    print(f"  -> Frequent 2-itemsets count: {len(freq_2)}")

    # Frequent 3-itemsets
    triplet_counts = defaultdict(int)
    for t in transactions:
        valid_items = [i for i in t if i in items_1]
        for trip in itertools.combinations(sorted(valid_items), 3):
            # Check all 2-subsets are frequent
            sub2_all = all(frozenset(pair) in freq_2 for pair in itertools.combinations(trip, 2))
            if sub2_all:
                triplet_counts[trip] += 1

    freq_3 = {frozenset(k): v / n_trans for k, v in triplet_counts.items() if (v / n_trans) >= min_support}
    print(f"  -> Frequent 3-itemsets count: {len(freq_3)}")

    # Merge all frequent itemsets
    all_freq = {}
    all_freq.update(freq_1)
    all_freq.update(freq_2)
    all_freq.update(freq_3)

    # Generate Association Rules: A -> B
    rules = []
    for itemset, sup_ab in all_freq.items():
        if len(itemset) < 2:
            continue
        for r_len in range(1, len(itemset)):
            for ant_tuple in itertools.combinations(itemset, r_len):
                ant = frozenset(ant_tuple)
                con = itemset - ant
                if ant in all_freq and con in all_freq:
                    sup_a = all_freq[ant]
                    sup_b = all_freq[con]
                    conf = sup_ab / sup_a
                    lift = conf / sup_b

                    if conf >= min_confidence and lift >= min_lift:
                        rules.append({
                            "antecedent": sorted(list(ant)),
                            "consequent": sorted(list(con)),
                            "support": round(float(sup_ab), 4),
                            "confidence": round(float(conf), 4),
                            "lift": round(float(lift), 3),
                            "support_pct": round(float(sup_ab * 100), 2),
                            "confidence_pct": round(float(conf * 100), 2)
                        })

    # Sort rules by Lift descending
    rules.sort(key=lambda r: (r["lift"], r["confidence"]), reverse=True)
    print(f"[MINING 5C] Discovered {len(rules)} association rules meeting Lift >= {min_lift} and Conf >= {min_confidence}.")

    # Save artifacts
    with open(os.path.join(artifacts_dir, "apriori_rules.json"), "w", encoding="utf-8") as f:
        json.dump({
            "min_support": min_support,
            "min_confidence": min_confidence,
            "min_lift": min_lift,
            "total_transactions": n_trans,
            "total_rules_generated": len(rules),
            "rules": rules
        }, f, indent=2)

    return rules


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    clean_csv = os.path.join(base_dir, "data", "clean_apps_analytical.csv")
    artifacts_dir = os.path.join(base_dir, "models", "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)

    print(f"[MINING] Reading clean analytical data from {clean_csv}...")
    df = pd.read_csv(clean_csv)

    train_classifiers(df, artifacts_dir)
    run_clustering(df, artifacts_dir)
    run_apriori_association(df, artifacts_dir)

    print(f"\n[MINING] Complete! All artifacts successfully saved to {artifacts_dir}")

if __name__ == "__main__":
    main()
