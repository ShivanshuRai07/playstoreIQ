"""
PlayStoreIQ — Warehouse Seeder & Population Script
Creates the Star Schema tables and populates Dim_* tables and Fact_App from
data/clean_apps_analytical.csv with full referential integrity.
"""
import os
import json
import sqlite3
import numpy as np
import pandas as pd
from sqlalchemy import text
from datetime import datetime

import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from database.connection import get_engine, execute_query

def map_domain_group(cat):
    cat = str(cat).upper()
    if "GAME" in cat:
        return "Gaming"
    elif cat in ("FAMILY", "EDUCATION", "PARENTING", "COMICS"):
        return "Family & Education"
    elif cat in ("BUSINESS", "PRODUCTIVITY", "FINANCE"):
        return "Business & Finance"
    elif cat in ("COMMUNICATION", "SOCIAL", "DATING"):
        return "Social & Communication"
    elif cat in ("PHOTOGRAPHY", "VIDEO_PLAYERS", "MUSIC_AND_AUDIO", "ENTERTAINMENT"):
        return "Media & Entertainment"
    elif cat in ("TOOLS", "WEATHER", "MAPS_AND_NAVIGATION"):
        return "Utilities & Tools"
    elif cat in ("HEALTH_AND_FITNESS", "MEDICAL", "LIFESTYLE", "BEAUTY", "FOOD_AND_DRINK", "SHOPPING", "TRAVEL_AND_LOCAL", "HOUSE_AND_HOME", "AUTO_AND_VEHICLES"):
        return "Lifestyle & Commerce"
    return "General"

def map_age_tier(cr):
    cr = str(cr).lower()
    if "everyone 10" in cr:
        return "Ages 10+"
    elif "everyone" in cr:
        return "All Ages"
    elif "teen" in cr:
        return "Teens (13+)"
    elif "mature 17" in cr:
        return "Mature (17+)"
    elif "18" in cr:
        return "Adults (18+)"
    return "Unrated"

def populate_warehouse():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    schema_path = os.path.join(base_dir, "database", "schema.sql")
    clean_csv_path = os.path.join(base_dir, "data", "clean_apps_analytical.csv")
    reports_dir = os.path.join(base_dir, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    print("[DWH] Initializing Star Schema tables...")
    engine = get_engine()
    
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    # Split and execute DDL statements
    with engine.begin() as conn:
        for statement in schema_sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))

    print("[DWH] Schema created successfully. Reading clean analytical dataset...")
    df = pd.read_csv(clean_csv_path)
    total_records = len(df)
    print(f"[DWH] Loaded {total_records} apps for warehouse ingestion.")

    # 1. Dim_App
    print("[DWH] Populating Dim_App...")
    dim_app = df[["App", "Current Ver", "IsFree"]].drop_duplicates(subset=["App"]).reset_index(drop=True)
    dim_app.insert(0, "app_id", range(1, len(dim_app) + 1))
    dim_app = dim_app.rename(columns={
        "App": "app_name",
        "Current Ver": "current_ver",
        "IsFree": "is_free"
    })
    dim_app["current_ver"] = dim_app["current_ver"].fillna("Unknown")
    dim_app.to_sql("dim_app", engine, if_exists="append", index=False)

    # 2. Dim_Date
    print("[DWH] Populating Dim_Date...")
    dates_series = pd.to_datetime(df["Last_Updated_ISO"], errors="coerce").dropna().drop_duplicates().sort_values().reset_index(drop=True)
    dim_date = pd.DataFrame({
        "date_id": range(1, len(dates_series) + 1),
        "full_date": dates_series.dt.strftime("%Y-%m-%d"),
        "day_num": dates_series.dt.day,
        "month_num": dates_series.dt.month,
        "month_name": dates_series.dt.strftime("%B"),
        "quarter_num": dates_series.dt.quarter,
        "year_num": dates_series.dt.year,
        "day_of_week": dates_series.dt.strftime("%A")
    })
    dim_date.to_sql("dim_date", engine, if_exists="append", index=False)

    # 3. Dim_Category
    print("[DWH] Populating Dim_Category...")
    cats_series = df["Category"].drop_duplicates().sort_values().reset_index(drop=True)
    dim_category = pd.DataFrame({
        "category_id": range(1, len(cats_series) + 1),
        "category_name": cats_series,
        "domain_group": cats_series.apply(map_domain_group)
    })
    dim_category.to_sql("dim_category", engine, if_exists="append", index=False)

    # 4. Dim_Type
    print("[DWH] Populating Dim_Type...")
    types_series = df["Type"].dropna().drop_duplicates().sort_values().reset_index(drop=True)
    dim_type = pd.DataFrame({
        "type_id": range(1, len(types_series) + 1),
        "type_name": types_series
    })
    dim_type.to_sql("dim_type", engine, if_exists="append", index=False)

    # 5. Dim_Genre
    print("[DWH] Populating Dim_Genre...")
    genres_series = df[["Genres", "Primary_Genre"]].dropna().drop_duplicates(subset=["Genres"]).sort_values(by="Genres").reset_index(drop=True)
    dim_genre = pd.DataFrame({
        "genre_id": range(1, len(genres_series) + 1),
        "genre_name": genres_series["Genres"],
        "primary_genre": genres_series["Primary_Genre"]
    })
    dim_genre.to_sql("dim_genre", engine, if_exists="append", index=False)

    # 6. Dim_ContentRating
    print("[DWH] Populating Dim_ContentRating...")
    cr_series = df["Content_Rating"].dropna().drop_duplicates().sort_values().reset_index(drop=True)
    dim_cr = pd.DataFrame({
        "content_rating_id": range(1, len(cr_series) + 1),
        "rating_name": cr_series,
        "age_tier": cr_series.apply(map_age_tier)
    })
    dim_cr.to_sql("dim_content_rating", engine, if_exists="append", index=False)

    # 7. Dim_AndroidVersion
    print("[DWH] Populating Dim_AndroidVersion...")
    df["Android_Ver_Clean"] = df["Android Ver"].fillna("Varies with device")
    ver_df = df[["Android_Ver_Clean", "Android_Min_Ver"]].drop_duplicates(subset=["Android_Ver_Clean"]).sort_values(by="Android_Ver_Clean").reset_index(drop=True)
    dim_ver = pd.DataFrame({
        "android_ver_id": range(1, len(ver_df) + 1),
        "raw_version": ver_df["Android_Ver_Clean"],
        "min_version": ver_df["Android_Min_Ver"]
    })
    dim_ver.to_sql("dim_android_version", engine, if_exists="append", index=False)

    # 8. Fact_App: Join surrogate keys
    print("[DWH] Building and populating Fact_App...")
    fact_df = df.copy()
    fact_df["App_clean"] = fact_df["App"]
    fact_df["Date_clean"] = fact_df["Last_Updated_ISO"]
    fact_df["Raw_Android"] = fact_df["Android_Ver_Clean"]

    fact_df = fact_df.merge(dim_app[["app_id", "app_name"]], left_on="App_clean", right_on="app_name", how="left")
    fact_df = fact_df.merge(dim_date[["date_id", "full_date"]], left_on="Date_clean", right_on="full_date", how="left")
    fact_df = fact_df.merge(dim_category[["category_id", "category_name"]], left_on="Category", right_on="category_name", how="left")
    fact_df = fact_df.merge(dim_type[["type_id", "type_name"]], left_on="Type", right_on="type_name", how="left")
    fact_df = fact_df.merge(dim_genre[["genre_id", "genre_name"]], left_on="Genres", right_on="genre_name", how="left")
    fact_df = fact_df.merge(dim_cr[["content_rating_id", "rating_name"]], left_on="Content_Rating", right_on="rating_name", how="left")
    fact_df = fact_df.merge(dim_ver[["android_ver_id", "raw_version"]], left_on="Raw_Android", right_on="raw_version", how="left")

    fact_table = pd.DataFrame({
        "fact_id": range(1, len(fact_df) + 1),
        "app_id": fact_df["app_id"],
        "date_id": fact_df["date_id"],
        "category_id": fact_df["category_id"],
        "type_id": fact_df["type_id"],
        "genre_id": fact_df["genre_id"],
        "content_rating_id": fact_df["content_rating_id"],
        "android_ver_id": fact_df["android_ver_id"],
        "rating": fact_df["Rating_Score"],
        "reviews_count": fact_df["Reviews_Count"],
        "installs_count": fact_df["Installs_Count"],
        "price_usd": fact_df["Price_USD"],
        "size_mb": fact_df["Size_MB"],
        "avg_sentiment_polarity": fact_df["avg_sentiment_polarity"],
        "avg_sentiment_subjectivity": fact_df["avg_sentiment_subjectivity"],
        "total_review_records": fact_df["total_review_records"],
        "popularity_class": fact_df["popularity_class"]
    })

    fact_table.to_sql("fact_app", engine, if_exists="append", index=False)

    # Verification Queries
    print("[DWH] Running warehouse integrity verification queries...")
    fact_count = execute_query("SELECT COUNT(*) as count FROM fact_app").iloc[0]["count"]
    dim_app_count = execute_query("SELECT COUNT(*) as count FROM dim_app").iloc[0]["count"]
    dim_cat_count = execute_query("SELECT COUNT(*) as count FROM dim_category").iloc[0]["count"]
    dim_date_count = execute_query("SELECT COUNT(*) as count FROM dim_date").iloc[0]["count"]
    
    orphan_check = execute_query("""
        SELECT COUNT(*) as orphans FROM fact_app f
        LEFT JOIN dim_app a ON f.app_id = a.app_id
        LEFT JOIN dim_category c ON f.category_id = c.category_id
        LEFT JOIN dim_date d ON f.date_id = d.date_id
        WHERE a.app_id IS NULL OR c.category_id IS NULL OR d.date_id IS NULL
    """).iloc[0]["orphans"]

    status = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "fact_app_count": int(fact_count),
        "dim_app_count": int(dim_app_count),
        "dim_category_count": int(dim_cat_count),
        "dim_date_count": int(dim_date_count),
        "dim_genre_count": int(len(dim_genre)),
        "dim_type_count": int(len(dim_type)),
        "dim_content_rating_count": int(len(dim_cr)),
        "dim_android_version_count": int(len(dim_ver)),
        "orphan_records_count": int(orphan_check),
        "integrity_verified": bool(fact_count == total_records and orphan_check == 0)
    }

    report_path = os.path.join(reports_dir, "warehouse_status.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2)

    print(f"[DWH] Population complete! Fact_App records: {fact_count}. Orphan FKs: {orphan_check}.")
    print(f"[DWH] Warehouse status saved to {report_path}")
    return status

if __name__ == "__main__":
    populate_warehouse()
