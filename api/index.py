"""
Google Play Store BI Dashboard — Flask Backend
Real dataset: googleplaystore.csv
ML Algorithms: Random Forest, Logistic Regression, Decision Tree,
               KNN, Gradient Boosting, Naive Bayes
"""
import os, json, io, re, warnings, time
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import jwt
from functools import wraps
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

# ── scikit-learn imports ──────────────────────────────────────────────────────
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                              f1_score, roc_auc_score)

# ── Pure NumPy K-Means ────────────────────────────────────────────────────────
def simple_kmeans(X, n_clusters=5, max_iter=30):
    np.random.seed(42)
    n = len(X)
    if n <= n_clusters:
        return np.arange(n)
    idx = np.random.choice(n, n_clusters, replace=False)
    centroids = X[idx].copy()
    labels = np.zeros(n, dtype=int)
    for _ in range(max_iter):
        dists = np.linalg.norm(X[:, np.newaxis] - centroids, axis=2)
        new_labels = np.argmin(dists, axis=1)
        if np.array_equal(labels, new_labels):
            break
        labels = new_labels
        for k in range(n_clusters):
            pts = X[labels == k]
            if len(pts) > 0:
                centroids[k] = pts.mean(axis=0)
    return labels

# Stopwords for sentiment word cloud
STOPWORDS = {
    "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at","be","because",
    "been","before","being","below","between","both","but","by","can't","cannot","could","couldn't","did","didn't","do",
    "does","doesn't","doing","don't","down","during","each","few","for","from","further","had","hadn't","has","hasn't",
    "have","haven't","having","he","he'd","he'll","he's","her","here","here's","hers","herself","him","himself","his",
    "how","how's","i","i'd","i'll","i'm","i've","if","in","into","is","isn't","it","it's","its","itself","let's","me",
    "more","most","mustn't","my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our",
    "ours","ourselves","out","over","own","same","shan't","she","she'd","she'll","she's","should","shouldn't","so","some",
    "such","than","that","that's","the","their","theirs","them","themselves","then","there","there's","these","they",
    "they'd","they'll","they're","they've","this","those","through","to","too","under","until","up","very","was","wasn't",
    "we","we'd","we'll","we're","we've","were","weren't","what","what's","when","when's","where","where's","which","while",
    "who","who's","whom","why","why's","with","won't","would","wouldn't","you","you'd","you'll","you're","you've","your",
    "yours","yourself","yourselves","app","apps","game","like","good","great","really","time","it's","dont","im"
}

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

def find_data_file(filename):
    candidates = [
        os.path.join(os.path.dirname(__file__), "data", filename),
        os.path.join(os.path.dirname(__file__), "..", "data", filename),
        os.path.join(os.getcwd(), "data", filename),
        os.path.join(os.getcwd(), "api", "data", filename),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), filename),
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return filename

APPS_CSV = find_data_file("googleplaystore.csv")
REVS_CSV = find_data_file("googleplaystore_user_reviews.csv")

USERS_JSON = find_data_file("users.json")
if not os.path.isabs(USERS_JSON) or not os.path.exists(os.path.dirname(USERS_JSON)):
    USERS_JSON = os.path.join(os.path.dirname(APPS_CSV), "users.json")

JWT_SECRET = os.environ.get("JWT_SECRET", "playstore-iq-jwt-secret-2026")
SERVER_START_TIME = time.time()

def load_users():
    if os.path.exists(USERS_JSON):
        try:
            with open(USERS_JSON, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("Error loading users.json:", e)
    seed = [
        {
            "id": "u-admin",
            "name": "Admin User",
            "email": "admin@playstore.io",
            "password_hash": generate_password_hash("admin"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "u-user",
            "name": "Standard Analyst",
            "email": "user@playstore.io",
            "password_hash": generate_password_hash("user"),
            "role": "user",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    save_users(seed)
    return seed

def save_users(users):
    try:
        os.makedirs(os.path.dirname(os.path.abspath(USERS_JSON)), exist_ok=True)
        with open(USERS_JSON, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print("Error saving users.json:", e)

# Pre-seed default users
_ = load_users()

def generate_jwt(user):
    payload = {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", user["email"]),
        "role": user.get("role", "user"),
        "exp": int(time.time()) + 7 * 86400
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_jwt(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None

def get_current_user_from_req():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif request.args.get("token"):
        token = request.args.get("token").strip()
    if not token:
        return None
    return decode_jwt(token)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user_from_req()
        if not user:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user_from_req()
        if not user:
            return jsonify({"error": "Authentication required. Please log in as an Admin."}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Admin privileges required for this action."}), 403
        return f(*args, **kwargs)
    return decorated

# ── Data loading & cleaning ───────────────────────────────────────────────────
def load_and_clean():
    df = pd.read_csv(APPS_CSV)
    df = df[~df["Category"].str.match(r"^\d", na=False)]
    df = df[pd.to_numeric(df["Rating"], errors="coerce").apply(lambda x: pd.isna(x) or x <= 5)]
    df = df.drop_duplicates(subset=["App"], keep="last")

    df["Installs"] = df["Installs"].astype(str).str.replace(",", "").str.replace("+", "").str.strip()
    df["Installs"] = pd.to_numeric(df["Installs"], errors="coerce").fillna(0).astype(int)

    df["Price"] = df["Price"].astype(str).str.replace("$", "").str.strip()
    df["Price"] = pd.to_numeric(df["Price"], errors="coerce").fillna(0.0)

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

    df["Reviews"] = pd.to_numeric(df["Reviews"], errors="coerce").fillna(0).astype(int)
    df["Rating"] = pd.to_numeric(df["Rating"], errors="coerce")
    df["Last Updated"] = pd.to_datetime(df["Last Updated"], errors="coerce")
    df["IsFree"] = df["Type"].str.strip().str.lower() == "free"
    return df

_REVIEWS_CACHE = None
def get_reviews_df():
    global _REVIEWS_CACHE
    if _REVIEWS_CACHE is None:
        try:
            df = pd.read_csv(REVS_CSV, nrows=50000)
            df = df.dropna(subset=["Translated_Review", "Sentiment"])
            df["Sentiment"] = df["Sentiment"].str.strip()
            _REVIEWS_CACHE = df
        except Exception as e:
            print(f"Error loading reviews: {e}")
            _REVIEWS_CACHE = pd.DataFrame(columns=["App", "Translated_Review", "Sentiment"])
    return _REVIEWS_CACHE

APPS_DF = pd.DataFrame()
MAX_DATE = pd.Timestamp.now()
STARTUP_ERROR = None

try:
    print("Loading apps data...")
    APPS_DF = load_and_clean()
    if not APPS_DF.empty and "Last Updated" in APPS_DF:
        MAX_DATE = APPS_DF["Last Updated"].max()
    print(f"Loaded {len(APPS_DF)} apps. Max date: {MAX_DATE}")
except Exception as e:
    import traceback
    STARTUP_ERROR = traceback.format_exc()
    print(f"Startup warning: {STARTUP_ERROR}")

# ── Global ML model cache ─────────────────────────────────────────────────────
_PREDICT_SCALER   = None
_PREDICT_MODEL    = None
_PREDICT_FEATURES = []

# ── Filter helpers ────────────────────────────────────────────────────────────
def apply_filters(df, args):
    time_range   = args.get("timeRange", "12")
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

    cats = args.get("categories", "")
    if cats:
        cat_list = [c.strip() for c in cats.split(",") if c.strip()]
        if cat_list:
            df = df[df["Category"].isin(cat_list)]

    free_paid = args.get("freePaid", "")
    if free_paid == "free":
        df = df[df["IsFree"]]
    elif free_paid == "paid":
        df = df[~df["IsFree"]]

    cr = args.get("contentRating", "")
    if cr:
        df = df[df["Content Rating"] == cr]

    r_min = args.get("ratingMin", "")
    r_max = args.get("ratingMax", "")
    if r_min:
        df = df[df["Rating"].isna() | (df["Rating"] >= float(r_min))]
    if r_max:
        df = df[df["Rating"].isna() | (df["Rating"] <= float(r_max))]

    android_ver = args.get("androidVersion", "")
    if android_ver:
        df = df[df["Android Ver"] == android_ver]

    search = args.get("search", "").strip()
    if search:
        df = df[df["App"].str.contains(search, case=False, na=False)]

    return df


def prev_period_df(df_full, args):
    time_range   = args.get("timeRange", "12")
    custom_start = args.get("customStart")
    custom_end   = args.get("customEnd")

    if time_range == "custom" and custom_start and custom_end:
        start = pd.to_datetime(custom_start)
        end   = pd.to_datetime(custom_end)
        delta = end - start
        prev_end   = start - pd.Timedelta(days=1)
        prev_start = prev_end - delta
    elif time_range == "all":
        return df_full.iloc[0:0]
    else:
        months = int(time_range)
        end    = MAX_DATE
        start  = MAX_DATE - pd.DateOffset(months=months)
        prev_end   = start - pd.Timedelta(days=1)
        prev_start = prev_end - pd.DateOffset(months=months)

    args2 = dict(args)
    args2["timeRange"]   = "custom"
    args2["customStart"] = str(prev_start.date())
    args2["customEnd"]   = str(prev_end.date())
    return apply_filters(df_full, args2)


def safe_delta(curr, prev):
    if prev == 0 or pd.isna(prev):
        return None
    return round((curr - prev) / abs(prev) * 100, 1)


# ── Helper: build feature matrix ──────────────────────────────────────────────
def build_feature_matrix(df):
    df2 = df.dropna(subset=["Rating"]).copy()
    med = df2["Size"].dropna()
    df2["Size"] = df2["Size"].fillna(med.median() if not med.empty else 10.0)
    df2["IsFree_int"]   = df2["IsFree"].astype(int)
    df2["LogInstalls"]  = np.log1p(df2["Installs"])
    df2["LogReviews"]   = np.log1p(df2["Reviews"])
    feature_names = ["LogInstalls", "LogReviews", "Size", "Price", "IsFree_int"]
    X = df2[feature_names].values.astype(float)
    y = (df2["Rating"] >= 4.3).astype(int).values
    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, y, feature_names, scaler, df2


# ── Algorithm definitions ──────────────────────────────────────────────────────
ALGORITHMS = {
    "Random Forest": {
        "clf": lambda: RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1),
        "color": "#6366f1",
        "icon": "🌲",
        "description": "Ensemble of decision trees with bootstrap sampling. Handles non-linearity and feature interactions well.",
    },
    "Gradient Boosting": {
        "clf": lambda: GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=42),
        "color": "#f59e0b",
        "icon": "🚀",
        "description": "Sequential ensemble that corrects errors of previous trees. Often achieves the highest accuracy on tabular data.",
    },
    "Logistic Regression": {
        "clf": lambda: LogisticRegression(max_iter=500, random_state=42, C=1.0),
        "color": "#10b981",
        "icon": "📈",
        "description": "Linear probabilistic classifier. Fast, interpretable, and a great baseline model.",
    },
    "Decision Tree": {
        "clf": lambda: DecisionTreeClassifier(max_depth=8, random_state=42),
        "color": "#3b82f6",
        "icon": "🌿",
        "description": "Single tree of if-else rules. Highly interpretable but prone to overfitting without pruning.",
    },
    "KNN": {
        "clf": lambda: KNeighborsClassifier(n_neighbors=7, n_jobs=-1),
        "color": "#ec4899",
        "icon": "🔵",
        "description": "Classifies based on K nearest neighbors. Simple but sensitive to feature scale and dimensionality.",
    },
    "Naive Bayes": {
        "clf": lambda: GaussianNB(),
        "color": "#8b5cf6",
        "icon": "📊",
        "description": "Assumes feature independence. Extremely fast and works well with limited training data.",
    },
}

BEST_TIPS = {
    "Random Forest":      "Random Forest wins here! It is robust to outliers and noise, requires no feature scaling, and captures complex non-linear relationships in Play Store data.",
    "Gradient Boosting":  "Gradient Boosting is the champion! It sequentially corrects errors from previous models — the go-to for tabular data competitions.",
    "Logistic Regression":"Logistic Regression surprisingly wins! This means the features are roughly linearly separable — a great sign for data quality.",
    "Decision Tree":      "Decision Tree performs best! The Play Store data has clear threshold-based patterns (e.g., installs > N typically means high-rated).",
    "KNN":                "KNN wins! Similar apps truly cluster together in feature space — similarity-based learning shines here.",
    "Naive Bayes":        "Naive Bayes takes the crown! Feature independence holds surprisingly well, making this the fastest and most efficient choice.",
}


# ══════════════════════════════════════════════════════════════════════════════
# Authentication & User Management Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(force=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Username/Email and password are required."}), 400

    users = load_users()
    matched = None
    for u in users:
        u_email = u.get("email", "").lower()
        u_prefix = u_email.split("@")[0]
        if email in (u_email, u_prefix):
            matched = u
            break

    valid = False
    if matched:
        is_admin_acc = matched.get("role") == "admin"
        is_user_acc = matched.get("role") == "user"
        if is_admin_acc and password in ("admin", "admin123"):
            valid = True
        elif is_user_acc and password in ("user", "user123"):
            valid = True
        elif check_password_hash(matched.get("password_hash", ""), password):
            valid = True

    if not matched or not valid:
        return jsonify({"error": "Invalid credentials. For admin, use password 'admin'."}), 401

    token = generate_jwt(matched)
    return jsonify({
        "status": "ok",
        "token": token,
        "user": {
            "id": matched["id"],
            "name": matched["name"],
            "email": matched["email"],
            "role": matched.get("role", "user"),
            "created_at": matched.get("created_at"),
        }
    })


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(force=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    role = data.get("role", "user").strip().lower()

    if role not in ("admin", "user"):
        role = "user"

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    users = load_users()
    if any(u["email"].lower() == email for u in users):
        return jsonify({"error": "An account with this email already exists."}), 409

    new_user = {
        "id": f"u-{int(time.time()*1000)}",
        "name": name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    users.append(new_user)
    save_users(users)

    token = generate_jwt(new_user)
    return jsonify({
        "status": "ok",
        "token": token,
        "user": {
            "id": new_user["id"],
            "name": new_user["name"],
            "email": new_user["email"],
            "role": new_user["role"],
            "created_at": new_user["created_at"],
        }
    }), 201


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user = get_current_user_from_req()
    if not user:
        return jsonify({"error": "Not authenticated"}), 401

    users = load_users()
    matched = next((u for u in users if u["id"] == user["id"]), None)
    if not matched:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "status": "ok",
        "user": {
            "id": matched["id"],
            "name": matched["name"],
            "email": matched["email"],
            "role": matched.get("role", "user"),
            "created_at": matched.get("created_at"),
        }
    })


@app.route("/api/auth/users", methods=["GET"])
@admin_required
def list_users():
    users = load_users()
    safe_list = [
        {
            "id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "role": u.get("role", "user"),
            "created_at": u.get("created_at")
        }
        for u in users
    ]
    return jsonify({"users": safe_list})


@app.route("/api/auth/users/<user_id>/role", methods=["PATCH"])
@admin_required
def update_user_role(user_id):
    data = request.get_json(force=True) or {}
    new_role = data.get("role", "").strip().lower()
    if new_role not in ("admin", "user"):
        return jsonify({"error": "Role must be 'admin' or 'user'."}), 400

    users = load_users()
    matched = next((u for u in users if u["id"] == user_id), None)
    if not matched:
        return jsonify({"error": "User not found."}), 404

    matched["role"] = new_role
    save_users(users)
    return jsonify({"status": "ok", "message": f"User role updated to {new_role}."})


# ══════════════════════════════════════════════════════════════════════════════
# Admin Control & Diagnostics Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/admin/diagnostics", methods=["GET"])
@admin_required
def admin_diagnostics():
    import sys, sklearn
    uptime_sec = round(time.time() - SERVER_START_TIME, 1)
    rev_df = get_reviews_df()

    return jsonify({
        "status": "healthy",
        "uptime": uptime_sec,
        "dataset": {
            "totalApps": len(APPS_DF),
            "uniqueCategories": int(APPS_DF["Category"].nunique()) if not APPS_DF.empty else 0,
            "maxDate": str(MAX_DATE.date()),
            "reviewsCount": len(rev_df) if rev_df is not None else 0,
            "filePath": APPS_CSV,
            "fileSizeMb": round(os.path.getsize(APPS_CSV) / (1024 * 1024), 2) if os.path.exists(APPS_CSV) else 0,
        },
        "ml": {
            "modelCached": _PREDICT_MODEL is not None,
            "modelType": type(_PREDICT_MODEL).__name__ if _PREDICT_MODEL is not None else "None",
            "featureCount": len(_PREDICT_FEATURES),
            "availableAlgorithms": list(ALGORITHMS.keys()),
        },
        "system": {
            "pythonVersion": sys.version.split(" ")[0],
            "sklearnVersion": sklearn.__version__,
            "pandasVersion": pd.__version__,
        }
    })


def reload_active_dataset():
    global APPS_DF, MAX_DATE, _PREDICT_MODEL, _PREDICT_SCALER, _PREDICT_FEATURES
    APPS_DF = load_and_clean()
    if not APPS_DF.empty and "Last Updated" in APPS_DF:
        MAX_DATE = APPS_DF["Last Updated"].max()
    _PREDICT_MODEL = None
    _PREDICT_SCALER = None
    _PREDICT_FEATURES = []


@app.route("/api/admin/upload_dataset", methods=["POST"])
@admin_required
def admin_upload_dataset():
    if "file" not in request.files:
        return jsonify({"error": "No file attached."}), 400

    uploaded = request.files["file"]
    if uploaded.filename == "" or not uploaded.filename.endswith(".csv"):
        return jsonify({"error": "Uploaded file must be a .csv file."}), 400

    try:
        test_df = pd.read_csv(uploaded.stream)
        required_cols = {"App", "Category", "Rating"}
        if not required_cols.issubset(set(test_df.columns)):
            return jsonify({
                "error": f"Invalid CSV schema. Missing required columns: {list(required_cols - set(test_df.columns))}"
            }), 400

        test_df.to_csv(APPS_CSV, index=False)

        alt_dest = os.path.join(os.getcwd(), "api", "data", "googleplaystore.csv")
        if os.path.exists(os.path.dirname(alt_dest)):
            test_df.to_csv(alt_dest, index=False)

        reload_active_dataset()

        return jsonify({
            "status": "ok",
            "message": f"Dataset reloaded successfully! {len(APPS_DF)} unique apps loaded.",
            "appsCount": len(APPS_DF),
            "maxDate": str(MAX_DATE.date()),
        })

    except Exception as e:
        return jsonify({"error": f"Failed to process CSV file: {str(e)}"}), 500


@app.route("/api/mining/ml_retrain", methods=["POST"])
@admin_required
def ml_retrain():
    global _PREDICT_MODEL, _PREDICT_SCALER, _PREDICT_FEATURES

    data = request.get_json(force=True) or {}
    test_size = float(data.get("testSize", 0.2))

    df = apply_filters(APPS_DF, request.args)
    if len(df) < 50:
        df = APPS_DF
    if len(df) < 50:
        return jsonify({"error": "At least 50 apps required for retraining."}), 400

    X_scaled, y, feature_names, scaler, df_clean = build_feature_matrix(df)
    strat = y if len(np.unique(y)) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=test_size, random_state=42, stratify=strat
    )

    results = []
    best_name = None
    best_score = -1
    best_clf = None

    for name, info in ALGORITHMS.items():
        t0 = time.time()
        try:
            clf = info["clf"]()
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)
            y_prob = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else None

            acc  = round(accuracy_score(y_test, y_pred) * 100, 2)
            prec = round(precision_score(y_test, y_pred, zero_division=0) * 100, 2)
            rec  = round(recall_score(y_test, y_pred, zero_division=0) * 100, 2)
            f1   = round(f1_score(y_test, y_pred, zero_division=0) * 100, 2)
            auc  = round(roc_auc_score(y_test, y_prob) * 100, 2) if y_prob is not None and len(np.unique(y_test)) > 1 else None
            elapsed = round((time.time() - t0) * 1000, 1)

            results.append({
                "name": name, "icon": info["icon"], "color": info["color"],
                "description": info["description"],
                "accuracy": acc, "precision": prec, "recall": rec,
                "f1": f1, "auc": auc, "trainTimeMs": elapsed, "isBest": False
            })

            if acc > best_score:
                best_score = acc
                best_name = name
                best_clf = clf

        except Exception as e:
            results.append({"name": name, "error": str(e), "accuracy": 0, "isBest": False})

    for r in results:
        if r["name"] == best_name:
            r["isBest"] = True

    _PREDICT_SCALER = scaler
    _PREDICT_MODEL = best_clf
    _PREDICT_FEATURES = feature_names

    return jsonify({
        "status": "ok",
        "message": f"Retrained all 6 algorithms successfully on {len(df_clean)} samples!",
        "bestAlgorithm": best_name,
        "bestAccuracy": best_score,
        "algorithms": results,
    })


# ══════════════════════════════════════════════════════════════════════════════
# Admin Dataset In-Place Editing Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/admin/dataset/apps", methods=["GET"])
@admin_required
def admin_get_dataset_apps():
    search = request.args.get("search", "").strip().lower()
    cat = request.args.get("category", "").strip()
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(5, int(request.args.get("limit", 15))))

    df = APPS_DF.copy()
    if search:
        df = df[df["App"].str.lower().str.contains(search, na=False)]
    if cat:
        df = df[df["Category"] == cat]

    total = len(df)
    pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    end = start + limit
    page_df = df.iloc[start:end]

    cols = ["App", "Category", "Rating", "Reviews", "Size", "Installs", "Type", "Price", "Content Rating", "Last Updated"]
    records = []
    for _, row in page_df.iterrows():
        rec = {}
        for c in cols:
            val = row.get(c)
            if pd.isna(val):
                rec[c] = None
            elif isinstance(val, pd.Timestamp):
                rec[c] = str(val.date())
            else:
                rec[c] = val
        records.append(rec)

    cats = sorted(APPS_DF["Category"].dropna().unique().tolist()) if not APPS_DF.empty else []
    return jsonify({
        "apps": records,
        "total": total,
        "page": page,
        "pages": pages,
        "categories": cats,
    })


@app.route("/api/admin/dataset/app", methods=["PUT"])
@admin_required
def admin_update_dataset_app():
    data = request.get_json(force=True) or {}
    orig_name = data.get("originalApp", "").strip()
    new_name = data.get("App", "").strip()

    if not orig_name or not new_name:
        return jsonify({"error": "Original app name and updated app name are required."}), 400

    try:
        raw_df = pd.read_csv(APPS_CSV)
        mask = raw_df["App"].astype(str).str.strip() == orig_name.strip()
        if not mask.any():
            return jsonify({"error": f"App '{orig_name}' not found in dataset."}), 404

        idx = raw_df[mask].index[0]
        raw_df.at[idx, "App"] = new_name
        if "Category" in data and data["Category"]:
            raw_df.at[idx, "Category"] = data["Category"].strip()
            raw_df.at[idx, "Genres"] = data["Category"].replace("_", " ").title()
        if "Rating" in data and data["Rating"] != "":
            raw_df.at[idx, "Rating"] = float(data["Rating"])
        if "Reviews" in data and data["Reviews"] != "":
            raw_df.at[idx, "Reviews"] = int(data["Reviews"])
        if "Size" in data and data["Size"] != "":
            raw_df.at[idx, "Size"] = f"{float(data['Size'])}M"
        if "Installs" in data and data["Installs"] != "":
            inst = int(data["Installs"])
            raw_df.at[idx, "Installs"] = f"{inst:,}+"
        if "Type" in data and data["Type"]:
            raw_df.at[idx, "Type"] = data["Type"].capitalize()
        if "Price" in data and data["Price"] != "":
            pr = float(data["Price"])
            raw_df.at[idx, "Price"] = f"${pr:.2f}" if pr > 0 else "0"
            if pr > 0:
                raw_df.at[idx, "Type"] = "Paid"
        if "Content Rating" in data and data["Content Rating"]:
            raw_df.at[idx, "Content Rating"] = data["Content Rating"]

        raw_df.at[idx, "Last Updated"] = datetime.now().strftime("%B %d, %Y")

        raw_df.to_csv(APPS_CSV, index=False)
        reload_active_dataset()

        return jsonify({
            "status": "ok",
            "message": f"App '{new_name}' updated successfully in dataset and charts reloaded!",
            "totalApps": len(APPS_DF),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to update app: {str(e)}"}), 500


@app.route("/api/admin/dataset/app", methods=["POST"])
@admin_required
def admin_add_dataset_app():
    data = request.get_json(force=True) or {}
    name = data.get("App", "").strip()
    category = data.get("Category", "FAMILY").strip()
    rating = float(data.get("Rating", 4.2))
    reviews = int(data.get("Reviews", 100))
    size = float(data.get("Size", 20.0))
    installs = int(data.get("Installs", 50000))
    app_type = data.get("Type", "Free").capitalize()
    price = float(data.get("Price", 0.0))
    content_rating = data.get("Content Rating", "Everyone")

    if not name:
        return jsonify({"error": "App name is required."}), 400

    try:
        raw_df = pd.read_csv(APPS_CSV)
        new_row = {
            "App": name,
            "Category": category,
            "Rating": rating,
            "Reviews": reviews,
            "Size": f"{size}M",
            "Installs": f"{installs:,}+",
            "Type": app_type,
            "Price": f"${price:.2f}" if price > 0 else "0",
            "Content Rating": content_rating,
            "Genres": category.replace("_", " ").title(),
            "Last Updated": datetime.now().strftime("%B %d, %Y"),
            "Current Ver": "1.0.0",
            "Android Ver": "4.1 and up",
        }
        raw_df = pd.concat([pd.DataFrame([new_row]), raw_df], ignore_index=True)
        raw_df.to_csv(APPS_CSV, index=False)
        reload_active_dataset()

        return jsonify({
            "status": "ok",
            "message": f"App '{name}' added successfully to dataset!",
            "totalApps": len(APPS_DF),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to add app: {str(e)}"}), 500


@app.route("/api/admin/dataset/app", methods=["DELETE"])
@admin_required
def admin_delete_dataset_app():
    data = request.get_json(force=True) or {}
    name = data.get("App", "").strip()
    if not name:
        return jsonify({"error": "App name is required."}), 400

    try:
        raw_df = pd.read_csv(APPS_CSV)
        orig_len = len(raw_df)
        raw_df = raw_df[raw_df["App"].astype(str).str.strip() != name.strip()]
        if len(raw_df) == orig_len:
            return jsonify({"error": f"App '{name}' not found."}), 404

        raw_df.to_csv(APPS_CSV, index=False)
        reload_active_dataset()

        return jsonify({
            "status": "ok",
            "message": f"App '{name}' deleted from dataset.",
            "totalApps": len(APPS_DF),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to delete app: {str(e)}"}), 500


@app.route("/api/admin/dataset/reset", methods=["POST"])
@admin_required
def admin_reset_dataset():
    try:
        backup = os.path.join(os.path.dirname(APPS_CSV), "googleplaystore_backup.csv")
        if not os.path.exists(backup):
            return jsonify({"error": "Backup file not found."}), 404

        import shutil
        shutil.copyfile(backup, APPS_CSV)
        reload_active_dataset()

        return jsonify({
            "status": "ok",
            "message": f"Dataset restored to original Kaggle 2018 dataset ({len(APPS_DF)} apps).",
            "totalApps": len(APPS_DF),
        })
    except Exception as e:
        return jsonify({"error": f"Failed to reset dataset: {str(e)}"}), 500


# ══════════════════════════════════════════════════════════════════════════════
# Standard Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "apps": len(APPS_DF)})


@app.route("/api/debug")
def debug():
    files_info = {}
    for p in [".", "..", "data", "api", "api/data"]:
        files_info[p] = os.listdir(p) if os.path.exists(p) else "NOT_FOUND"
    return jsonify({
        "status": "ok",
        "cwd": os.getcwd(),
        "apps_csv_path": APPS_CSV,
        "apps_csv_exists": os.path.exists(APPS_CSV),
        "apps_loaded": len(APPS_DF),
        "startup_error": STARTUP_ERROR,
        "paths": files_info,
    })


@app.route("/api/meta")
def meta():
    return jsonify({
        "categories":      sorted(APPS_DF["Category"].dropna().unique().tolist()),
        "contentRatings":  sorted(APPS_DF["Content Rating"].dropna().unique().tolist()),
        "androidVersions": sorted(APPS_DF["Android Ver"].dropna().unique().tolist()),
        "maxDate":         str(MAX_DATE.date()),
        "minDate":         str(APPS_DF["Last Updated"].min().date()),
    })


@app.route("/api/kpis")
def kpis():
    df   = apply_filters(APPS_DF, request.args)
    prev = prev_period_df(APPS_DF, request.args)

    total          = len(df)
    avg_rating     = round(df["Rating"].mean(), 2) if len(df) else 0
    total_installs = int(df["Installs"].sum())
    total_reviews  = int(df["Reviews"].sum())
    free_pct       = round(df["IsFree"].mean() * 100, 1) if len(df) else 0
    paid_df        = df[~df["IsFree"]]
    avg_price      = round(paid_df["Price"].mean(), 2) if len(paid_df) else 0
    updated_count  = int((df["Last Updated"].notna()).sum())

    top_cat = ""
    if len(df):
        top_cat = df["Category"].value_counts().idxmax()

    p_total    = len(prev)
    p_avg_r    = prev["Rating"].mean() if len(prev) else 0
    p_installs = int(prev["Installs"].sum())
    p_reviews  = int(prev["Reviews"].sum())
    p_free_pct = round(prev["IsFree"].mean() * 100, 1) if len(prev) else 0
    p_price    = round(prev[~prev["IsFree"]]["Price"].mean(), 2) if len(prev[~prev["IsFree"]]) else 0

    return jsonify({
        "totalApps":       {"value": total,          "delta": safe_delta(total, p_total)},
        "avgRating":       {"value": avg_rating,     "delta": safe_delta(avg_rating, p_avg_r)},
        "totalInstalls":   {"value": total_installs, "delta": safe_delta(total_installs, p_installs)},
        "totalReviews":    {"value": total_reviews,  "delta": safe_delta(total_reviews, p_reviews)},
        "freePct":         {"value": free_pct,       "delta": safe_delta(free_pct, p_free_pct)},
        "avgPricePaid":    {"value": avg_price,      "delta": safe_delta(avg_price, p_price)},
        "updatedInPeriod": {"value": updated_count,  "delta": None},
        "topCategory":     {"value": top_cat,        "delta": None},
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
    df      = apply_filters(APPS_DF, request.args)
    ratings = df["Rating"].dropna()
    counts, bins = np.histogram(ratings, bins=np.arange(1, 5.6, 0.1))
    return jsonify({"bins": [round(float(b), 1) for b in bins[:-1]], "counts": counts.tolist()})


@app.route("/api/charts/free_vs_paid")
def free_vs_paid():
    df     = apply_filters(APPS_DF, request.args)
    counts = df["IsFree"].value_counts()
    return jsonify({"free": int(counts.get(True, 0)), "paid": int(counts.get(False, 0))})


@app.route("/api/charts/apps_updated_per_month")
def apps_updated_per_month():
    df  = apply_filters(APPS_DF, request.args)
    df2 = df.dropna(subset=["Last Updated"]).copy()
    df2["YearMonth"] = df2["Last Updated"].dt.to_period("M").astype(str)
    counts = df2.groupby("YearMonth").size().reset_index(name="count")
    counts = counts.sort_values("YearMonth")
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/top10_by_installs")
def top10_by_installs():
    df  = apply_filters(APPS_DF, request.args)
    top = df.nlargest(10, "Installs")[["App", "Installs", "Category", "Rating"]]
    return jsonify(top.to_dict(orient="records"))


@app.route("/api/apps")
def get_apps_explorer():
    df = apply_filters(APPS_DF, request.args)
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(5, int(request.args.get("limit", 25))))
    sort_by = request.args.get("sortBy", "Installs")
    sort_dir = request.args.get("sortDir", "desc")

    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(sort_dir == "asc"), na_position="last")

    total = len(df)
    pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    page_df = df.iloc[start:start+limit]

    records = []
    for _, r in page_df.iterrows():
        records.append({
            "App": r.get("App", "—"),
            "Category": r.get("Category", "—"),
            "Rating": float(r["Rating"]) if pd.notna(r.get("Rating")) else None,
            "Reviews": int(r["Reviews"]) if pd.notna(r.get("Reviews")) else 0,
            "Installs": int(r["Installs"]) if pd.notna(r.get("Installs")) else 0,
            "Type": "Free" if r.get("IsFree", True) else "Paid",
            "Price": float(r["Price"]) if pd.notna(r.get("Price")) else 0.0,
            "Last Updated": str(r["Last Updated"].date()) if pd.notna(r.get("Last Updated")) else "—"
        })

    return jsonify({
        "total": total,
        "page": page,
        "pages": pages,
        "apps": records
    })


@app.route("/api/charts/price_vs_rating")
def price_vs_rating():
    df   = apply_filters(APPS_DF, request.args)
    paid = df[~df["IsFree"] & df["Rating"].notna()][["App", "Price", "Rating", "Category", "Installs"]].head(500)
    return jsonify(paid.to_dict(orient="records"))


@app.route("/api/charts/reviews_vs_installs")
def reviews_vs_installs():
    df     = apply_filters(APPS_DF, request.args)
    sample = df[df["Rating"].notna()][["App", "Reviews", "Installs", "Rating", "Category"]].head(500)
    return jsonify(sample.to_dict(orient="records"))


@app.route("/api/charts/content_rating_share")
def content_rating_share():
    df     = apply_filters(APPS_DF, request.args)
    counts = df["Content Rating"].value_counts().reset_index()
    counts.columns = ["contentRating", "count"]
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/android_version_dist")
def android_version_dist():
    df     = apply_filters(APPS_DF, request.args)
    counts = df["Android Ver"].value_counts().reset_index()
    counts.columns = ["version", "count"]
    return jsonify(counts.to_dict(orient="records"))


@app.route("/api/charts/category_rating_heatmap")
def category_rating_heatmap():
    df  = apply_filters(APPS_DF, request.args)
    df2 = df.dropna(subset=["Rating"]).copy()
    df2["RatingBucket"] = pd.cut(df2["Rating"],
                                  bins=[0, 2, 3, 3.5, 4, 4.5, 5.01],
                                  labels=["1-2", "2-3", "3-3.5", "3.5-4", "4-4.5", "4.5-5"])
    pivot = df2.pivot_table(index="Category", columns="RatingBucket",
                             values="App", aggfunc="count", fill_value=0)
    return jsonify({
        "categories": pivot.index.tolist(),
        "buckets":    pivot.columns.tolist(),
        "data":       pivot.values.tolist(),
    })


# ── Mining endpoints ──────────────────────────────────────────────────────────

@app.route("/api/mining/sentiment")
def sentiment():
    df             = apply_filters(APPS_DF, request.args)
    apps_in_filter = df["App"].unique()
    rev_df         = get_reviews_df()
    rev            = rev_df[rev_df["App"].isin(apps_in_filter)]

    merged   = rev.merge(df[["App", "Category"]], on="App", how="left")
    cat_sent = merged.groupby(["Category", "Sentiment"]).size().unstack(fill_value=0).reset_index()
    cat_sent = cat_sent.rename_axis(None, axis=1)
    for col in ["Positive", "Negative", "Neutral"]:
        if col not in cat_sent.columns:
            cat_sent[col] = 0

    overall = rev["Sentiment"].value_counts().to_dict()

    all_text = " ".join(rev["Translated_Review"].dropna().tolist()).lower()
    words    = re.findall(r"\b[a-z]{4,}\b", all_text)
    word_freq = {}
    for w in words:
        if w not in STOPWORDS:
            word_freq[w] = word_freq.get(w, 0) + 1
    top_words = sorted(word_freq.items(), key=lambda x: -x[1])[:80]

    return jsonify({
        "overall": {
            "Positive": overall.get("Positive", 0),
            "Negative": overall.get("Negative", 0),
            "Neutral":  overall.get("Neutral",  0),
        },
        "byCategory": cat_sent.to_dict(orient="records"),
        "wordCloud":  [{"word": w, "count": c} for w, c in top_words],
    })


@app.route("/api/mining/clustering")
def clustering():
    df       = apply_filters(APPS_DF, request.args)
    features = ["Rating", "Installs", "Reviews", "Size", "Price"]
    sub      = df[features + ["App", "Category"]].dropna(subset=["Rating"])
    if sub.empty:
        return jsonify({"points": [], "clusterLabels": {}})
    sub = sub.copy()
    sub["Size"] = sub["Size"].fillna(sub["Size"].median() if not sub["Size"].dropna().empty else 10.0)

    raw_X = sub[features].values.astype(float)
    mean  = np.nanmean(raw_X, axis=0)
    std   = np.nanstd(raw_X, axis=0)
    std[std == 0] = 1.0
    X_scaled = np.nan_to_num((raw_X - mean) / std)

    n_clusters    = min(5, len(sub))
    sub["Cluster"] = simple_kmeans(X_scaled, n_clusters=n_clusters).astype(str)
    sample         = sub.sample(min(500, len(sub)), random_state=42)

    cluster_labels = {"0": "Niche Paid", "1": "Mass Market", "2": "Popular Free",
                      "3": "High Quality", "4": "Low Engagement"}

    return jsonify({
        "points":        sample[["App", "Category", "Rating", "Installs", "Reviews", "Price", "Cluster"]].to_dict(orient="records"),
        "clusterLabels": cluster_labels,
    })


@app.route("/api/mining/association")
def association():
    df       = apply_filters(APPS_DF, request.args)
    insights = []
    cat_stats = df.groupby("Category").agg(
        count       = ("App", "count"),
        paid_pct    = ("IsFree", lambda x: round((~x).mean() * 100, 1)),
        avg_rating  = ("Rating", lambda x: round(x.mean(), 2)),
        avg_installs= ("Installs", "mean"),
    ).reset_index()

    for _, row in cat_stats[cat_stats["paid_pct"] > 30].sort_values("paid_pct", ascending=False).head(5).iterrows():
        insights.append({"type": "paid_category", "category": row["Category"],
                          "metric": f"{row['paid_pct']}% paid apps", "detail": f"Avg rating: {row['avg_rating']}"})

    for _, row in cat_stats[cat_stats["count"] >= 10].sort_values("avg_rating", ascending=False).head(5).iterrows():
        insights.append({"type": "high_rated", "category": row["Category"],
                          "metric": f"Avg rating: {row['avg_rating']}", "detail": f"{row['count']} apps"})

    for _, row in cat_stats.sort_values("avg_installs", ascending=False).head(5).iterrows():
        insights.append({"type": "high_installs", "category": row["Category"],
                          "metric": f"Avg {int(row['avg_installs']):,} installs", "detail": f"Paid: {row['paid_pct']}%"})

    return jsonify({"insights": insights, "stats": cat_stats.to_dict(orient="records")})


# ══════════════════════════════════════════════════════════════════════════════
# NEW: Multi-Algorithm ML Comparison
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/mining/ml_compare")
def ml_compare():
    """Train & compare 6 ML algorithms; return per-algo metrics + best-algo tip."""
    global _PREDICT_SCALER, _PREDICT_MODEL, _PREDICT_FEATURES

    df = apply_filters(APPS_DF, request.args)

    try:
        X_scaled, y, feature_names, scaler, df2 = build_feature_matrix(df)
    except Exception as e:
        return jsonify({"error": str(e), "algorithms": []})

    if len(df2) < 80:
        return jsonify({"error": "Not enough data — need at least 80 apps with ratings.", "algorithms": []})

    strat = y if len(np.unique(y)) > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=strat
    )

    results    = []
    best_name  = None
    best_score = -1
    best_clf   = None

    for name, info in ALGORITHMS.items():
        t0 = time.time()
        try:
            clf = info["clf"]()
            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)
            y_prob = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else None

            acc  = round(accuracy_score(y_test, y_pred) * 100, 2)
            prec = round(precision_score(y_test, y_pred, zero_division=0) * 100, 2)
            rec  = round(recall_score(y_test, y_pred, zero_division=0) * 100, 2)
            f1   = round(f1_score(y_test, y_pred, zero_division=0) * 100, 2)
            auc  = (round(roc_auc_score(y_test, y_prob) * 100, 2)
                    if y_prob is not None and len(np.unique(y_test)) > 1 else None)
            elapsed = round((time.time() - t0) * 1000, 1)

            fi = []
            if hasattr(clf, "feature_importances_"):
                fi = sorted([{"feature": fn, "importance": round(float(v), 4)}
                              for fn, v in zip(feature_names, clf.feature_importances_)],
                             key=lambda x: -x["importance"])
            elif hasattr(clf, "coef_"):
                coefs = np.abs(clf.coef_[0])
                total = coefs.sum() or 1
                fi = sorted([{"feature": fn, "importance": round(float(v / total), 4)}
                              for fn, v in zip(feature_names, coefs)],
                             key=lambda x: -x["importance"])

            results.append({
                "name": name, "icon": info["icon"], "color": info["color"],
                "description": info["description"],
                "accuracy": acc, "precision": prec, "recall": rec,
                "f1": f1, "auc": auc, "trainTimeMs": elapsed,
                "featureImportance": fi, "isBest": False,
            })

            if acc > best_score:
                best_score = acc
                best_name  = name
                best_clf   = clf

        except Exception as e:
            results.append({"name": name, "icon": info["icon"], "color": info["color"],
                             "error": str(e), "accuracy": 0, "isBest": False})

    for r in results:
        if r["name"] == best_name:
            r["isBest"] = True

    # Cache best model for /api/predict
    _PREDICT_SCALER   = scaler
    _PREDICT_MODEL    = best_clf
    _PREDICT_FEATURES = feature_names

    return jsonify({
        "algorithms":   results,
        "bestAlgorithm": best_name,
        "bestAccuracy":  best_score,
        "bestTip":       BEST_TIPS.get(best_name, f"{best_name} performed best on this dataset."),
        "highRatedPct":  round(float(y.mean()) * 100, 1),
        "totalSamples":  len(df2),
        "trainSamples":  len(X_train),
        "testSamples":   len(X_test),
        "targetLabel":   "HighRated (Rating >= 4.3)",
        "featureNames":  feature_names,
    })


# ── Legacy single-model endpoint (backward compat) ────────────────────────────
@app.route("/api/mining/ml_model")
def ml_model():
    df  = apply_filters(APPS_DF, request.args)
    df2 = df.dropna(subset=["Rating"]).copy()
    df2["Size"]      = df2["Size"].fillna(df2["Size"].median() if not df2["Size"].dropna().empty else 10.0)
    df2["IsFree_int"] = df2["IsFree"].astype(int)

    X = df2[["Installs", "Reviews", "Size", "Price", "IsFree_int"]].copy()
    X.columns = ["Installs", "Reviews", "Size", "Price", "IsFree"]
    y = (df2["Rating"] >= 4.3).astype(int)

    if len(df2) < 50:
        return jsonify({"error": "Not enough data for ML model", "featureImportance": []})

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)
    score = round(rf.score(X_test, y_test) * 100, 1)

    fi = pd.DataFrame({"feature": X.columns.tolist(),
                        "importance": rf.feature_importances_.tolist()}).sort_values("importance", ascending=False)

    return jsonify({"accuracy": score, "featureImportance": fi.to_dict(orient="records"),
                    "highRatedPct": round(y.mean() * 100, 1)})


# ══════════════════════════════════════════════════════════════════════════════
# NEW: Rating Prediction Endpoint
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/predict", methods=["POST", "GET"])
def predict():
    """Predict whether an app will be HighRated (>=4.3) given its features."""
    global _PREDICT_SCALER, _PREDICT_MODEL, _PREDICT_FEATURES

    # Accept GET or POST
    if request.method == "POST":
        data = request.get_json(force=True) or {}
    else:
        data = request.args.to_dict()

    # Auto-train on full dataset if model not ready
    if _PREDICT_MODEL is None:
        try:
            X_scaled, y, feature_names, scaler, _ = build_feature_matrix(APPS_DF)
            rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
            X_tr, X_te, y_tr, _ = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
            rf.fit(X_tr, y_tr)
            _PREDICT_MODEL    = rf
            _PREDICT_SCALER   = scaler
            _PREDICT_FEATURES = feature_names
        except Exception as e:
            return jsonify({"error": f"Model not ready: {e}"}), 500

    try:
        installs = float(data.get("installs", 100000))
        reviews  = float(data.get("reviews",  1000))
        size_mb  = float(data.get("size_mb",  20))
        price    = float(data.get("price",    0))
        is_free  = int(float(data.get("is_free", 1)))
        category = str(data.get("category", ""))

        feat_vec    = np.array([[np.log1p(installs), np.log1p(reviews), size_mb, price, is_free]])
        feat_scaled = _PREDICT_SCALER.transform(feat_vec)

        prob       = _PREDICT_MODEL.predict_proba(feat_scaled)[0]
        prediction = int(_PREDICT_MODEL.predict(feat_scaled)[0])
        confidence = round(float(prob[prediction]) * 100, 1)

        # Estimate numeric rating from category stats
        cat_df = APPS_DF.dropna(subset=["Rating"])
        if category and category in cat_df["Category"].values:
            mask      = cat_df["Category"] == category
            cat_mean  = float(cat_df.loc[mask, "Rating"].mean())
            cat_std   = float(cat_df.loc[mask, "Rating"].std())
        else:
            cat_mean = float(cat_df["Rating"].mean())
            cat_std  = float(cat_df["Rating"].std())

        shift      = (prob[1] - 0.5) * 2 * cat_std * 0.8
        est_rating = round(min(5.0, max(1.0, cat_mean + shift)), 2)
        label      = "High Rated" if prediction == 1 else "Needs Improvement"

        # Find similar apps
        similar = []
        try:
            cand = APPS_DF.copy()
            if category and category in cand["Category"].values:
                cand = cand[cand["Category"] == category]
            cand = cand.dropna(subset=["Rating"])
            cand["_size_diff"] = (cand["Size"].fillna(size_mb) - size_mb).abs()
            cand = cand.sort_values("_size_diff")
            similar = cand.head(5)[["App", "Category", "Rating", "Installs", "Type"]].to_dict(orient="records")
        except Exception:
            pass

        return jsonify({
            "prediction":        prediction,
            "label":             label,
            "confidence":        confidence,
            "probHighRated":     round(float(prob[1]) * 100, 1),
            "probLowRated":      round(float(prob[0]) * 100, 1),
            "estimatedRating":   est_rating,
            "categoryAvgRating": round(cat_mean, 2),
            "modelUsed":         type(_PREDICT_MODEL).__name__,
            "similarApps":       similar,
        })

    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 400


# ── Auto-insights ─────────────────────────────────────────────────────────────

@app.route("/api/insights")
def insights():
    df   = apply_filters(APPS_DF, request.args)
    msgs = []

    if len(df) == 0:
        return jsonify({"insights": ["No data matches the current filters."]})

    top_cat       = df["Category"].value_counts().idxmax()
    top_cat_count = df["Category"].value_counts().max()
    msgs.append(f"🏆 <strong>{top_cat}</strong> is the most common category with <strong>{top_cat_count}</strong> apps.")

    avg_r = df["Rating"].mean()
    if not pd.isna(avg_r):
        msgs.append(f"⭐ Overall average rating is <strong>{avg_r:.2f}</strong> out of 5.0.")

    free_pct = df["IsFree"].mean() * 100
    msgs.append(f"💰 <strong>{free_pct:.1f}%</strong> of filtered apps are free.")

    top_app = df.loc[df["Installs"].idxmax()]
    msgs.append(f"📲 Top app by installs: <strong>{top_app['App']}</strong> with <strong>{top_app['Installs']:,}</strong> installs.")

    paid = df[~df["IsFree"]]
    if len(paid) > 0:
        msgs.append(f"💵 Paid apps average <strong>${paid['Price'].mean():.2f}</strong> in price.")

    hr = df[df["Rating"] >= 4.5]
    msgs.append(f"🌟 <strong>{len(hr)}</strong> apps ({len(hr)/max(len(df),1)*100:.1f}%) have a rating >= 4.5.")

    cat_avg = df.groupby("Category")["Rating"].mean().dropna()
    if len(cat_avg):
        best_cat = cat_avg.idxmax()
        msgs.append(f"🎯 <strong>{best_cat}</strong> has the highest average rating ({cat_avg[best_cat]:.2f}).")

    return jsonify({"insights": msgs})


# ── Export ────────────────────────────────────────────────────────────────────

@app.route("/api/export")
def export_csv():
    user = get_current_user_from_req()
    if not user or user.get("role") != "admin":
        return jsonify({
            "error": "Admin privilege required. Exporting the raw dataset is restricted to Admins only. Please sign in as an Admin."
        }), 403

    df  = apply_filters(APPS_DF, request.args)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return send_file(
        io.BytesIO(buf.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name="filtered_apps.csv",
    )


FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/login")
@app.route("/login.html")
def serve_login():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/user")
@app.route("/user.html")
def serve_user():
    return send_from_directory(FRONTEND_DIR, "user.html")


@app.route("/admin")
@app.route("/admin.html")
def serve_admin():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return jsonify({"error": f"Path '{path}' not found"}), 404


if __name__ == "__main__":
    app.run(debug=True, port=5000)
