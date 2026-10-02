"""
Google Play Store BI Dashboard — Flask Backend
"""
import os, json, io, re, warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# ── ML imports ──────────────────────────────────────────────────────────────
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import nltk
import tempfile

nltk_dir = os.path.join(tempfile.gettempdir(), "nltk_data")
os.makedirs(nltk_dir, exist_ok=True)
if nltk_dir not in nltk.data.path:
    nltk.data.path.append(nltk_dir)

try:
    nltk.download("punkt", download_dir=nltk_dir, quiet=True)
    nltk.download("stopwords", download_dir=nltk_dir, quiet=True)
except Exception:
    pass

from nltk.corpus import stopwords

# ── App setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(BASE_DIR, "data")):
    BASE_DIR = os.getcwd()
DATA_DIR = os.path.join(BASE_DIR, "data")
APPS_CSV = os.path.join(DATA_DIR, "googleplaystore.csv")
REVS_CSV = os.path.join(DATA_DIR, "googleplaystore_user_reviews.csv")

# ── Data loading & cleaning ──────────────────────────────────────────────────
def load_and_clean():
    df = pd.read_csv(APPS_CSV)

    # Drop the malformed row (Rating > 5 or Category is a number)
    df = df[~df["Category"].str.match(r"^\d", na=False)]
    df = df[pd.to_numeric(df["Rating"], errors="coerce").apply(lambda x: pd.isna(x) or x <= 5)]

    # Remove duplicates (keep last, which mimics the original dataset strategy)
    df = df.drop_duplicates(subset=["App"], keep="last")

    # Installs → int
    df["Installs"] = df["Installs"].astype(str).str.replace(",", "").str.replace("+", "").str.strip()
    df["Installs"] = pd.to_numeric(df["Installs"], errors="coerce").fillna(0).astype(int)

    # Price → float
    df["Price"] = df["Price"].astype(str).str.replace("$", "").str.strip()
    df["Price"] = pd.to_numeric(df["Price"], errors="coerce").fillna(0.0)

    # Size → float (MB)
    def parse_size(s):
        s = str(s).strip()
        if s.lower() in ("varies with device", "nan", ""):
            return np.nan
        if s.endswith("M"):
            return float(s[:-1])
        if s.endswith("k"):
            return float(s[:-1]) / 1024
        return np.nan
    df["Size"] = df["Size"].apply(parse_size)

    # Reviews → int
    df["Reviews"] = pd.to_numeric(df["Reviews"], errors="coerce").fillna(0).astype(int)

    # Rating → float, null where missing
    df["Rating"] = pd.to_numeric(df["Rating"], errors="coerce")

    # Last Updated → datetime
    df["Last Updated"] = pd.to_datetime(df["Last Updated"], errors="coerce", infer_datetime_format=True)

    # Derived columns
    df["IsFree"] = df["Type"].str.strip().str.lower() == "free"

    return df

def load_reviews():
    df = pd.read_csv(REVS_CSV)
    df = df.dropna(subset=["Translated_Review", "Sentiment"])
    df["Sentiment"] = df["Sentiment"].str.strip()
    return df

print("Loading data…")
APPS_DF   = load_and_clean()
REVIEWS_DF = load_reviews()
MAX_DATE   = APPS_DF["Last Updated"].max()
print(f"Loaded {len(APPS_DF)} apps, {len(REVIEWS_DF)} reviews. Max date: {MAX_DATE}")

# ── Filter helper ────────────────────────────────────────────────────────────
def apply_filters(df, args):
    # Time range
    time_range = args.get("timeRange", "12")
    custom_start = args.get("customStart")
    custom_end   = args.get("customEnd")

    if time_range == "custom" and custom_start and custom_end:
        start = pd.to_datetime(custom_start)
        end   = pd.to_datetime(custom_end)
    elif time_range == "all":
        start, end = None, None
    else:
        months = int(time_range)
        end    = MAX_DATE
        start  = MAX_DATE - pd.DateOffset(months=months)

    if start is not None:
        df = df[df["Last Updated"] >= start]
    if end is not None:
        df = df[df["Last Updated"] <= end]

    # Category (comma-separated)
    cats = args.get("categories", "")
    if cats:
        cat_list = [c.strip() for c in cats.split(",") if c.strip()]
        if cat_list:
            df = df[df["Category"].isin(cat_list)]

    # Free/Paid
    free_paid = args.get("freePaid", "")
    if free_paid == "free":
        df = df[df["IsFree"]]
    elif free_paid == "paid":
        df = df[~df["IsFree"]]

    # Content rating
    cr = args.get("contentRating", "")
    if cr:
        df = df[df["Content Rating"] == cr]

    # Rating range
    r_min = args.get("ratingMin", "")
    r_max = args.get("ratingMax", "")
    if r_min:
        df = df[df["Rating"].isna() | (df["Rating"] >= float(r_min))]
    if r_max:
        df = df[df["Rating"].isna() | (df["Rating"] <= float(r_max))]

    # Android version
    android_ver = args.get("androidVersion", "")
    if android_ver:
        df = df[df["Android Ver"] == android_ver]

    # App name search
    search = args.get("search", "").strip()
    if search:
        df = df[df["App"].str.contains(search, case=False, na=False)]

    return df


def prev_period_df(df_full, args):
    """Return the previous equivalent time window."""
    time_range = args.get("timeRange", "12")
    custom_start = args.get("customStart")
    custom_end   = args.get("customEnd")

    if time_range == "custom" and custom_start and custom_end:
        start = pd.to_datetime(custom_start)
        end   = pd.to_datetime(custom_end)
        delta = end - start
        prev_end   = start - pd.Timedelta(days=1)
        prev_start = prev_end - delta
    elif time_range == "all":
        return df_full.iloc[0:0]  # empty
    else:
        months = int(time_range)
        end    = MAX_DATE
        start  = MAX_DATE - pd.DateOffset(months=months)
        prev_end   = start - pd.Timedelta(days=1)
        prev_start = prev_end - pd.DateOffset(months=months)

    prev = df_full[
        (df_full["Last Updated"] >= prev_end - (prev_end - prev_start)) &
        (df_full["Last Updated"] <= prev_end)
    ]
    # Apply non-time filters
    args2 = dict(args)
    args2["timeRange"] = "custom"
    args2["customStart"] = str(prev_start.date())
    args2["customEnd"]   = str(prev_end.date())
    return apply_filters(df_full, args2)


def safe_delta(curr, prev):
    if prev == 0 or pd.isna(prev):
        return None
    return round((curr - prev) / abs(prev) * 100, 1)


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/meta")
def meta():
    """Return filter option lists."""
    return jsonify({
        "categories":      sorted(APPS_DF["Category"].dropna().unique().tolist()),
        "contentRatings":  sorted(APPS_DF["Content Rating"].dropna().unique().tolist()),
        "androidVersions": sorted(APPS_DF["Android Ver"].dropna().unique().tolist()),
        "maxDate":         str(MAX_DATE.date()),
        "minDate":         str(APPS_DF["Last Updated"].min().date()),
    })


@app.route("/api/kpis")
def kpis():
    df  = apply_filters(APPS_DF, request.args)
    prev = prev_period_df(APPS_DF, request.args)

    total          = len(df)
    avg_rating     = round(df["Rating"].mean(), 2) if len(df) else 0
    total_installs = int(df["Installs"].sum())
    total_reviews  = int(df["Reviews"].sum())
    free_pct       = round(df["IsFree"].mean() * 100, 1) if len(df) else 0
    paid_df        = df[~df["IsFree"]]
    avg_price      = round(paid_df["Price"].mean(), 2) if len(paid_df) else 0
    updated_count  = int((df["Last Updated"].notna()).sum())

    # Top category
    top_cat = ""
    if len(df):
        top_cat = df["Category"].value_counts().idxmax()

    # Deltas
    p_total    = len(prev)
    p_avg_r    = prev["Rating"].mean() if len(prev) else 0
    p_installs = int(prev["Installs"].sum())
    p_reviews  = int(prev["Reviews"].sum())
    p_free_pct = round(prev["IsFree"].mean() * 100, 1) if len(prev) else 0
    p_price    = round(prev[~prev["IsFree"]]["Price"].mean(), 2) if len(prev[~prev["IsFree"]]) else 0

    return jsonify({
        "totalApps":        {"value": total,          "delta": safe_delta(total, p_total)},
        "avgRating":        {"value": avg_rating,     "delta": safe_delta(avg_rating, p_avg_r)},
        "totalInstalls":    {"value": total_installs,  "delta": safe_delta(total_installs, p_installs)},
        "totalReviews":     {"value": total_reviews,   "delta": safe_delta(total_reviews, p_reviews)},
        "freePct":          {"value": free_pct,        "delta": safe_delta(free_pct, p_free_pct)},
        "avgPricePaid":     {"value": avg_price,       "delta": safe_delta(avg_price, p_price)},
        "updatedInPeriod":  {"value": updated_count,   "delta": None},
        "topCategory":      {"value": top_cat,         "delta": None},
    })


@app.route("/api/charts/apps_per_category")
def apps_per_category():
    df = apply_filters(APPS_DF, request.args)
    counts = df["Category"].value_counts().reset_index()
    counts.columns = ["category", "count"]
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/installs_by_category")
def installs_by_category():
    df = apply_filters(APPS_DF, request.args)
    agg = df.groupby("Category")["Installs"].sum().reset_index()
    agg.columns = ["category", "installs"]
    agg = agg.sort_values("installs", ascending=False)
    return jsonify(agg.to_dict(orient="records"))


@app.route("/api/charts/rating_distribution")
def rating_distribution():
    df = apply_filters(APPS_DF, request.args)
    ratings = df["Rating"].dropna()
    counts, bins = np.histogram(ratings, bins=np.arange(1, 5.6, 0.1))
    return jsonify({
        "bins":   [round(float(b), 1) for b in bins[:-1]],
        "counts": counts.tolist()
    })


@app.route("/api/charts/free_vs_paid")
def free_vs_paid():
    df = apply_filters(APPS_DF, request.args)
    counts = df["IsFree"].value_counts()
    return jsonify({
        "free": int(counts.get(True, 0)),
        "paid": int(counts.get(False, 0))
    })


@app.route("/api/charts/apps_updated_per_month")
def apps_updated_per_month():
    df = apply_filters(APPS_DF, request.args)
    df2 = df.dropna(subset=["Last Updated"]).copy()
    df2["YearMonth"] = df2["Last Updated"].dt.to_period("M").astype(str)
    counts = df2.groupby("YearMonth").size().reset_index(name="count")
    counts = counts.sort_values("YearMonth")
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/top10_by_installs")
def top10_by_installs():
    df = apply_filters(APPS_DF, request.args)
    top = df.nlargest(10, "Installs")[["App", "Installs", "Category", "Rating"]]
    return jsonify(top.to_dict(orient="records"))


@app.route("/api/charts/price_vs_rating")
def price_vs_rating():
    df = apply_filters(APPS_DF, request.args)
    paid = df[~df["IsFree"] & df["Rating"].notna()][["App", "Price", "Rating", "Category", "Installs"]].head(500)
    return jsonify(paid.to_dict(orient="records"))


@app.route("/api/charts/reviews_vs_installs")
def reviews_vs_installs():
    df = apply_filters(APPS_DF, request.args)
    sample = df[df["Rating"].notna()][["App", "Reviews", "Installs", "Rating", "Category"]].head(500)
    return jsonify(sample.to_dict(orient="records"))


@app.route("/api/charts/content_rating_share")
def content_rating_share():
    df = apply_filters(APPS_DF, request.args)
    counts = df["Content Rating"].value_counts().reset_index()
    counts.columns = ["contentRating", "count"]
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/android_version_dist")
def android_version_dist():
    df = apply_filters(APPS_DF, request.args)
    counts = df["Android Ver"].value_counts().reset_index()
    counts.columns = ["version", "count"]
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/category_rating_heatmap")
def category_rating_heatmap():
    df = apply_filters(APPS_DF, request.args)
    df2 = df.dropna(subset=["Rating"]).copy()
    df2["RatingBucket"] = pd.cut(df2["Rating"],
                                  bins=[0, 2, 3, 3.5, 4, 4.5, 5.01],
                                  labels=["1-2", "2-3", "3-3.5", "3.5-4", "4-4.5", "4.5-5"])
    pivot = df2.pivot_table(index="Category", columns="RatingBucket", values="App",
                             aggfunc="count", fill_value=0)
    return jsonify({
        "categories": pivot.index.tolist(),
        "buckets":    pivot.columns.tolist(),
        "data":       pivot.values.tolist()
    })


# ── Mining endpoints ─────────────────────────────────────────────────────────

@app.route("/api/mining/sentiment")
def sentiment():
    df  = apply_filters(APPS_DF, request.args)
    apps_in_filter = df["App"].unique()
    rev = REVIEWS_DF[REVIEWS_DF["App"].isin(apps_in_filter)]

    # Per category: join on App → Category
    merged = rev.merge(df[["App", "Category"]], on="App", how="left")

    cat_sent = merged.groupby(["Category", "Sentiment"]).size().unstack(fill_value=0).reset_index()
    cat_sent = cat_sent.rename_axis(None, axis=1)
    for col in ["Positive", "Negative", "Neutral"]:
        if col not in cat_sent.columns:
            cat_sent[col] = 0

    # Overall counts
    overall = rev["Sentiment"].value_counts().to_dict()

    # Word cloud words
    all_text = " ".join(rev["Translated_Review"].dropna().tolist()).lower()
    stop_words = set(stopwords.words("english")) | {"app", "apps", "it", "this", "the", "is", "it's"}
    words = re.findall(r"\b[a-z]{4,}\b", all_text)
    word_freq = {}
    for w in words:
        if w not in stop_words:
            word_freq[w] = word_freq.get(w, 0) + 1

    top_words = sorted(word_freq.items(), key=lambda x: -x[1])[:80]

    return jsonify({
        "overall": {
            "Positive": overall.get("Positive", 0),
            "Negative": overall.get("Negative", 0),
            "Neutral":  overall.get("Neutral", 0),
        },
        "byCategory": cat_sent.to_dict(orient="records"),
        "wordCloud":  [{"word": w, "count": c} for w, c in top_words]
    })


@app.route("/api/mining/clustering")
def clustering():
    df = apply_filters(APPS_DF, request.args)
    features = ["Rating", "Installs", "Reviews", "Size", "Price"]
    sub = df[features + ["App", "Category"]].dropna(subset=["Rating"])
    sub = sub.copy()
    sub["Size"] = sub["Size"].fillna(sub["Size"].median())

    scaler = StandardScaler()
    X = scaler.fit_transform(sub[features])

    n_clusters = min(5, len(sub))
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    sub = sub.copy()
    sub["Cluster"] = km.fit_predict(X).astype(str)

    # Sample for response size
    sample = sub.sample(min(500, len(sub)), random_state=42)

    cluster_labels = {
        "0": "Niche Paid",
        "1": "Mass Market",
        "2": "Popular Free",
        "3": "High Quality",
        "4": "Low Engagement"
    }

    return jsonify({
        "points": sample[["App", "Category", "Rating", "Installs", "Reviews", "Price", "Cluster"]].to_dict(orient="records"),
        "clusterLabels": cluster_labels
    })


@app.route("/api/mining/association")
def association():
    df = apply_filters(APPS_DF, request.args)

    # Categories that tend to be paid & high-rated
    insights = []
    cat_stats = df.groupby("Category").agg(
        count=("App", "count"),
        paid_pct=("IsFree", lambda x: round((~x).mean() * 100, 1)),
        avg_rating=("Rating", lambda x: round(x.mean(), 2)),
        avg_installs=("Installs", "mean")
    ).reset_index()

    # High paid categories
    paid_high = cat_stats[cat_stats["paid_pct"] > 30].sort_values("paid_pct", ascending=False).head(5)
    for _, row in paid_high.iterrows():
        insights.append({
            "type": "paid_category",
            "category": row["Category"],
            "metric": f"{row['paid_pct']}% paid apps",
            "detail": f"Avg rating: {row['avg_rating']}"
        })

    # High rated categories
    rated_high = cat_stats[cat_stats["count"] >= 10].sort_values("avg_rating", ascending=False).head(5)
    for _, row in rated_high.iterrows():
        insights.append({
            "type": "high_rated",
            "category": row["Category"],
            "metric": f"Avg rating: {row['avg_rating']}",
            "detail": f"{row['count']} apps"
        })

    # Most installed categories
    top_install = cat_stats.sort_values("avg_installs", ascending=False).head(5)
    for _, row in top_install.iterrows():
        insights.append({
            "type": "high_installs",
            "category": row["Category"],
            "metric": f"Avg {int(row['avg_installs']):,} installs",
            "detail": f"Paid: {row['paid_pct']}%"
        })

    return jsonify({"insights": insights, "stats": cat_stats.to_dict(orient="records")})


@app.route("/api/mining/ml_model")
def ml_model():
    df = apply_filters(APPS_DF, request.args)
    df2 = df.dropna(subset=["Rating"]).copy()
    df2["Size"] = df2["Size"].fillna(df2["Size"].median())

    features = ["Installs", "Reviews", "Size", "Price", "IsFree"]
    df2["HighRated"] = (df2["Rating"] >= 4.3).astype(int)
    df2["IsFree_int"] = df2["IsFree"].astype(int)

    X = df2[["Installs", "Reviews", "Size", "Price", "IsFree_int"]].copy()
    X.columns = ["Installs", "Reviews", "Size", "Price", "IsFree"]
    y = df2["HighRated"]

    if len(df2) < 50:
        return jsonify({"error": "Not enough data for ML model", "featureImportance": []})

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    score = round(rf.score(X_test, y_test) * 100, 1)

    fi = pd.DataFrame({
        "feature": X.columns.tolist(),
        "importance": rf.feature_importances_.tolist()
    }).sort_values("importance", ascending=False)

    return jsonify({
        "accuracy": score,
        "featureImportance": fi.to_dict(orient="records"),
        "highRatedPct": round(y.mean() * 100, 1)
    })


# ── Auto-insights ────────────────────────────────────────────────────────────

@app.route("/api/insights")
def insights():
    df = apply_filters(APPS_DF, request.args)
    msgs = []

    if len(df) == 0:
        return jsonify({"insights": ["No data matches the current filters."]})

    # Top category
    top_cat = df["Category"].value_counts().idxmax()
    top_cat_count = df["Category"].value_counts().max()
    msgs.append(f"🏆 <strong>{top_cat}</strong> is the most common category with <strong>{top_cat_count}</strong> apps.")

    # Avg rating
    avg_r = df["Rating"].mean()
    if not pd.isna(avg_r):
        msgs.append(f"⭐ Overall average rating is <strong>{avg_r:.2f}</strong> out of 5.0.")

    # Free vs paid
    free_pct = df["IsFree"].mean() * 100
    msgs.append(f"💰 <strong>{free_pct:.1f}%</strong> of filtered apps are free.")

    # Top app by installs
    top_app = df.loc[df["Installs"].idxmax()]
    msgs.append(f"📲 Top app by installs: <strong>{top_app['App']}</strong> with <strong>{top_app['Installs']:,}</strong> installs.")

    # Paid apps avg price
    paid = df[~df["IsFree"]]
    if len(paid) > 0:
        msgs.append(f"💵 Paid apps average <strong>${paid['Price'].mean():.2f}</strong> in price.")

    # High-rated apps
    hr = df[df["Rating"] >= 4.5]
    msgs.append(f"🌟 <strong>{len(hr)}</strong> apps ({len(hr)/max(len(df),1)*100:.1f}%) have a rating ≥ 4.5.")

    # Category with best avg rating
    cat_avg = df.groupby("Category")["Rating"].mean().dropna()
    if len(cat_avg):
        best_cat = cat_avg.idxmax()
        msgs.append(f"🎯 <strong>{best_cat}</strong> has the highest average rating ({cat_avg[best_cat]:.2f}).")

    return jsonify({"insights": msgs})


# ── Export ───────────────────────────────────────────────────────────────────

@app.route("/api/export")
def export_csv():
    df = apply_filters(APPS_DF, request.args)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return send_file(
        io.BytesIO(buf.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name="filtered_apps.csv"
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
