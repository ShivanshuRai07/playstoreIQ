"""
PlayStoreIQ — Dataset Profiling & Data Quality Audit Script
Profiles googleplaystore.csv and googleplaystore_user_reviews.csv.
Computes row counts, missing values, duplicates, distributions, skew, and anomalies.
Outputs reports/data_quality_metrics.json for use in reports and viva documentation.
"""
import os
import json
import numpy as np
import pandas as pd

def run_profiling():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    reports_dir = os.path.join(os.path.dirname(__file__), "..", "reports")
    os.makedirs(reports_dir, exist_ok=True)

    apps_file = os.path.join(data_dir, "googleplaystore.csv")
    revs_file = os.path.join(data_dir, "googleplaystore_user_reviews.csv")

    apps_df = pd.read_csv(apps_file)
    revs_df = pd.read_csv(revs_file)

    # 1. Apps Dataset Profiling
    app_profile = {
        "file_name": "googleplaystore.csv",
        "total_rows": int(len(apps_df)),
        "total_columns": int(apps_df.shape[1]),
        "columns": list(apps_df.columns),
        "column_types": {col: str(dtype) for col, dtype in apps_df.dtypes.items()},
        "null_counts": {col: int(apps_df[col].isnull().sum()) for col in apps_df.columns},
        "null_percentages": {col: round(float(apps_df[col].isnull().sum() / len(apps_df) * 100), 2) for col in apps_df.columns},
        "duplicate_rows_exact": int(apps_df.duplicated().sum()),
        "duplicate_app_names": int(apps_df['App'].duplicated().sum()),
        "unique_apps": int(apps_df['App'].nunique()),
        "unique_categories": int(apps_df['Category'].nunique()),
        "categories_list": sorted([str(c) for c in apps_df['Category'].dropna().unique()]),
        "type_distribution": {str(k): int(v) for k, v in apps_df['Type'].value_counts(dropna=False).items()},
        "content_rating_distribution": {str(k): int(v) for k, v in apps_df['Content Rating'].value_counts(dropna=False).items()}
    }

    # Cleaned numeric conversions for statistical analysis
    # Installs
    installs_clean = apps_df['Installs'].astype(str).str.replace(',', '').str.replace('+', '').str.strip()
    installs_num = pd.to_numeric(installs_clean, errors='coerce').fillna(0)
    app_profile["installs_stats"] = {
        "min": int(installs_num.min()),
        "max": int(installs_num.max()),
        "mean": round(float(installs_num.mean()), 2),
        "median": float(installs_num.median()),
        "skewness": round(float(installs_num.skew()), 2),
        "install_tiers": {
            "tier_0_low_under_10k": int((installs_num < 10000).sum()),
            "tier_1_mid_10k_to_1m": int(((installs_num >= 10000) & (installs_num <= 1000000)).sum()),
            "tier_2_high_above_1m": int((installs_num > 1000000).sum())
        }
    }

    # Ratings
    ratings_clean = pd.to_numeric(apps_df['Rating'], errors='coerce')
    valid_ratings = ratings_clean.dropna()
    app_profile["rating_stats"] = {
        "valid_count": int(valid_ratings.count()),
        "missing_count": int(ratings_clean.isnull().sum()),
        "min": round(float(valid_ratings.min()), 2),
        "max": round(float(valid_ratings.max()), 2),
        "mean": round(float(valid_ratings.mean()), 2),
        "median": round(float(valid_ratings.median()), 2),
        "std": round(float(valid_ratings.std()), 2),
        "skewness": round(float(valid_ratings.skew()), 2),
        "out_of_bounds_count (>5.0)": int((ratings_clean > 5.0).sum())
    }

    # Price
    price_clean = apps_df['Price'].astype(str).str.replace('$', '').str.strip()
    price_num = pd.to_numeric(price_clean, errors='coerce').fillna(0.0)
    app_profile["price_stats"] = {
        "free_apps_count": int((price_num == 0.0).sum()),
        "paid_apps_count": int((price_num > 0.0).sum()),
        "max_price": round(float(price_num.max()), 2),
        "mean_paid_price": round(float(price_num[price_num > 0].mean()), 2) if (price_num > 0).any() else 0.0,
        "median_paid_price": round(float(price_num[price_num > 0].median()), 2) if (price_num > 0).any() else 0.0
    }

    # 2. Reviews Dataset Profiling
    rev_profile = {
        "file_name": "googleplaystore_user_reviews.csv",
        "total_rows": int(len(revs_df)),
        "total_columns": int(revs_df.shape[1]),
        "columns": list(revs_df.columns),
        "null_counts": {col: int(revs_df[col].isnull().sum()) for col in revs_df.columns},
        "null_percentages": {col: round(float(revs_df[col].isnull().sum() / len(revs_df) * 100), 2) for col in revs_df.columns},
        "unique_apps_in_reviews": int(revs_df['App'].nunique()),
        "apps_overlapping_with_apps_csv": int(revs_df['App'].isin(apps_df['App']).sum()),
        "sentiment_counts": {str(k): int(v) for k, v in revs_df['Sentiment'].value_counts(dropna=False).items()}
    }

    valid_polarity = revs_df['Sentiment_Polarity'].dropna()
    rev_profile["polarity_stats"] = {
        "valid_count": int(valid_polarity.count()),
        "mean": round(float(valid_polarity.mean()), 3),
        "median": round(float(valid_polarity.median()), 3),
        "std": round(float(valid_polarity.std()), 3),
        "min": round(float(valid_polarity.min()), 3),
        "max": round(float(valid_polarity.max()), 3),
        "skewness": round(float(valid_polarity.skew()), 3)
    }

    full_metrics = {
        "profiling_timestamp": pd.Timestamp.now().isoformat(),
        "apps_dataset": app_profile,
        "reviews_dataset": rev_profile
    }

    output_path = os.path.join(reports_dir, "data_quality_metrics.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(full_metrics, f, indent=2)

    print(f"Profiling complete. Saved metrics to {output_path}")
    print(f"Apps: {app_profile['total_rows']} rows, {app_profile['unique_apps']} unique apps, {app_profile['unique_categories']} categories.")
    print(f"Reviews: {rev_profile['total_rows']} rows, {rev_profile['sentiment_counts']['Positive']} positive reviews.")
    return full_metrics

if __name__ == "__main__":
    run_profiling()
