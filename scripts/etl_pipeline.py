"""
PlayStoreIQ — Canonical ETL Pipeline
Extracts raw apps and user reviews datasets, validates schemas, cleans and standardizes
all data types, handles duplicates, aggregates sentiment measures, derives mining targets,
and outputs the canonical analytical warehouse tables with a full audit log.
"""
import os
import re
import json
import numpy as np
import pandas as pd
from datetime import datetime

VALID_CATEGORIES = {
    "ART_AND_DESIGN", "AUTO_AND_VEHICLES", "BEAUTY", "BOOKS_AND_REFERENCE",
    "BUSINESS", "COMICS", "COMMUNICATION", "DATING", "EDUCATION", "ENTERTAINMENT",
    "EVENTS", "FAMILY", "FINANCE", "FOOD_AND_DRINK", "GAME", "HEALTH_AND_FITNESS",
    "HOUSE_AND_HOME", "LIBRARIES_AND_DEMO", "LIFESTYLE", "MAPS_AND_NAVIGATION",
    "MEDICAL", "NEWS_AND_MAGAZINES", "PARENTING", "PERSONALIZATION", "PHOTOGRAPHY",
    "PRODUCTIVITY", "SHOPPING", "SOCIAL", "SPORTS", "TOOLS", "TRAVEL_AND_LOCAL",
    "VIDEO_PLAYERS", "WEATHER"
}

def parse_size_mb(val):
    """Converts size strings like '14M', '512k' into float Megabytes."""
    if pd.isna(val):
        return np.nan
    s = str(val).strip()
    if s.lower() in ("varies with device", "nan", "", "none"):
        return np.nan
    try:
        if s.endswith("M") or s.endswith("m"):
            return round(float(s[:-1]), 2)
        if s.endswith("k") or s.endswith("K"):
            return round(float(s[:-1]) / 1024.0, 4)
        return round(float(s), 2)
    except Exception:
        return np.nan

def parse_android_min_ver(val):
    """Extracts minimum numerical Android version, e.g., '4.1 and up' -> 4.1."""
    if pd.isna(val):
        return 4.0
    s = str(val).strip()
    match = re.search(r"(\d+\.\d+|\d+)", s)
    if match:
        try:
            return float(match.group(1))
        except Exception:
            return 4.0
    return 4.0

def run_etl(data_dir=None, reports_dir=None):
    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    if reports_dir is None:
        reports_dir = os.path.join(os.path.dirname(__file__), "..", "reports")
    os.makedirs(reports_dir, exist_ok=True)

    apps_path = os.path.join(data_dir, "googleplaystore.csv")
    revs_path = os.path.join(data_dir, "googleplaystore_user_reviews.csv")

    print("[ETL] Stage 1: Extracting raw datasets...")
    raw_apps = pd.read_csv(apps_path)
    raw_revs = pd.read_csv(revs_path)

    n_raw_apps = len(raw_apps)
    n_raw_revs = len(raw_revs)
    print(f"[ETL] Extracted {n_raw_apps} app records and {n_raw_revs} review records.")

    # Stage 2: Validation & Anomaly Rejection
    print("[ETL] Stage 2: Validating schema and isolating corrupted rows...")
    rejections = []
    valid_mask = pd.Series(True, index=raw_apps.index)

    # Check category validity
    for idx, row in raw_apps.iterrows():
        cat = str(row.get("Category", "")).strip()
        rating = row.get("Rating")
        reason = None
        if cat not in VALID_CATEGORIES and not cat.replace("_", "").isalnum():
            reason = f"Invalid category '{cat}'"
        elif pd.notna(rating):
            try:
                r_num = float(rating)
                if r_num < 1.0 or r_num > 5.0:
                    reason = f"Rating out of bounds ({r_num})"
            except Exception:
                reason = f"Malformed rating value '{rating}'"

        if reason:
            valid_mask[idx] = False
            rejections.append({
                "row_index": int(idx),
                "app": str(row.get("App", "UNKNOWN")),
                "reason": reason
            })

    rejected_count = len(rejections)
    clean_apps_stage1 = raw_apps[valid_mask].copy()

    # Stage 3: Transformation & Cleaning
    print("[ETL] Stage 3: Transforming fields and normalizing types...")
    # App name
    clean_apps_stage1["App"] = clean_apps_stage1["App"].astype(str).str.strip()

    # Installs
    clean_apps_stage1["Installs_Clean"] = (
        clean_apps_stage1["Installs"]
        .astype(str)
        .str.replace(",", "", regex=False)
        .str.replace("+", "", regex=False)
        .str.strip()
    )
    clean_apps_stage1["Installs_Count"] = pd.to_numeric(clean_apps_stage1["Installs_Clean"], errors="coerce").fillna(0).astype(int)

    # Price
    clean_apps_stage1["Price_Clean"] = (
        clean_apps_stage1["Price"]
        .astype(str)
        .str.replace("$", "", regex=False)
        .str.strip()
    )
    clean_apps_stage1["Price_USD"] = pd.to_numeric(clean_apps_stage1["Price_Clean"], errors="coerce").fillna(0.0)

    # Type & IsFree resolution
    clean_apps_stage1["Type"] = clean_apps_stage1.apply(
        lambda r: "Free" if float(r.get("Price_USD", 0.0)) == 0.0 else "Paid",
        axis=1
    )
    clean_apps_stage1["IsFree"] = clean_apps_stage1["Type"] == "Free"

    # Size
    clean_apps_stage1["Size_MB"] = clean_apps_stage1["Size"].apply(parse_size_mb)

    # Reviews
    clean_apps_stage1["Reviews_Count"] = pd.to_numeric(clean_apps_stage1["Reviews"], errors="coerce").fillna(0).astype(int)

    # Rating
    clean_apps_stage1["Rating_Score"] = pd.to_numeric(clean_apps_stage1["Rating"], errors="coerce")

    # Last Updated Date
    clean_apps_stage1["Last_Updated_Date"] = pd.to_datetime(clean_apps_stage1["Last Updated"], errors="coerce")
    clean_apps_stage1["Last_Updated_ISO"] = clean_apps_stage1["Last_Updated_Date"].dt.strftime("%Y-%m-%d")

    # Android Min Version
    clean_apps_stage1["Android_Min_Ver"] = clean_apps_stage1["Android Ver"].apply(parse_android_min_ver)

    # Content Rating
    clean_apps_stage1["Content_Rating"] = clean_apps_stage1["Content Rating"].fillna("Everyone").astype(str).str.strip()

    # Primary Genre
    clean_apps_stage1["Primary_Genre"] = clean_apps_stage1["Genres"].astype(str).apply(lambda x: x.split(";")[0].strip())

    # Stage 4: Duplicate Resolution
    print("[ETL] Stage 4: Resolving duplicate app entries...")
    before_dedup = len(clean_apps_stage1)
    # Sort by Last_Updated_Date (descending) and Reviews_Count (descending) to keep the most recent & comprehensive entry
    clean_apps_stage1 = clean_apps_stage1.sort_values(
        by=["Last_Updated_Date", "Reviews_Count"], ascending=[False, False]
    )
    clean_apps = clean_apps_stage1.drop_duplicates(subset=["App"], keep="first").copy()
    duplicates_resolved = before_dedup - len(clean_apps)

    # Stage 5: Review Aggregation & Feature Derivation
    print("[ETL] Stage 5: Aggregating sentiment measures & deriving mining targets...")
    valid_revs = raw_revs.dropna(subset=["Sentiment_Polarity"]).copy()
    sentiment_agg = valid_revs.groupby("App").agg(
        avg_sentiment_polarity=("Sentiment_Polarity", "mean"),
        avg_sentiment_subjectivity=("Sentiment_Subjectivity", "mean"),
        total_review_records=("Sentiment", "count")
    ).reset_index()

    # Merge sentiments with apps
    clean_apps = clean_apps.merge(sentiment_agg, on="App", how="left")
    clean_apps["avg_sentiment_polarity"] = clean_apps["avg_sentiment_polarity"].round(3)
    clean_apps["avg_sentiment_subjectivity"] = clean_apps["avg_sentiment_subjectivity"].round(3)
    clean_apps["total_review_records"] = clean_apps["total_review_records"].fillna(0).astype(int)

    # Derive Mining Target: Popularity Class
    # 0 = Low (<10,000 installs)
    # 1 = Medium (10,000 to 1,000,000 installs)
    # 2 = High / Viral (>1,000,000 installs)
    def calc_popularity_tier(installs):
        if installs < 10000:
            return 0
        elif installs <= 1000000:
            return 1
        else:
            return 2

    clean_apps["popularity_class"] = clean_apps["Installs_Count"].apply(calc_popularity_tier)
    clean_apps["app_name_len"] = clean_apps["App"].astype(str).str.len()
    clean_apps["app_name_words"] = clean_apps["App"].astype(str).apply(lambda x: len(x.split()))

    # Calculate category median size for ML imputation
    cat_median_sizes = clean_apps.groupby("Category")["Size_MB"].median().to_dict()
    overall_median_size = clean_apps["Size_MB"].median() or 14.0
    clean_apps["size_imputed_mb"] = clean_apps.apply(
        lambda r: cat_median_sizes.get(r["Category"], overall_median_size) if pd.isna(r["Size_MB"]) else r["Size_MB"],
        axis=1
    ).round(2)

    # Stage 6: Export Analytical Output
    print("[ETL] Stage 6: Saving canonical analytical dataset...")
    analytical_csv = os.path.join(data_dir, "clean_apps_analytical.csv")
    clean_apps.to_csv(analytical_csv, index=False)

    # Stage 7: Audit Reconciliation Report
    n_clean_apps = len(clean_apps)
    reconciliation_passed = (n_raw_apps - rejected_count - duplicates_resolved) == n_clean_apps

    audit_report = {
        "pipeline_version": "2.0-DWM",
        "execution_timestamp": datetime.utcnow().isoformat() + "Z",
        "metrics": {
            "source_raw_apps_count": n_raw_apps,
            "source_raw_reviews_count": n_raw_revs,
            "rejected_records_count": rejected_count,
            "duplicate_records_resolved": duplicates_resolved,
            "clean_analytical_apps_count": n_clean_apps,
            "reviewed_apps_matched": int((clean_apps["total_review_records"] > 0).sum()),
            "reconciliation_formula": "N_raw - N_rejected - N_dupes == N_clean",
            "reconciliation_passed": bool(reconciliation_passed)
        },
        "target_class_distribution": {
            "class_0_low_under_10k": int((clean_apps["popularity_class"] == 0).sum()),
            "class_1_mid_10k_to_1m": int((clean_apps["popularity_class"] == 1).sum()),
            "class_2_high_above_1m": int((clean_apps["popularity_class"] == 2).sum())
        },
        "rejection_log": rejections
    }

    audit_path = os.path.join(reports_dir, "etl_audit_report.json")
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_report, f, indent=2)

    print(f"[ETL] Pipeline finished successfully.")
    print(f"[ETL] Clean Apps: {n_clean_apps} | Reconciled: {reconciliation_passed}")
    print(f"[ETL] Audit report saved to {audit_path}")
    return clean_apps, audit_report

if __name__ == "__main__":
    run_etl()
