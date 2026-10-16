"""
PlayStoreIQ — Mining Service (Inference & Analytics Serving)
Loads precomputed ML models, scalers, clustering results, and Apriori association rules.
Provides millisecond inference and eliminates retraining during web requests (Vercel-safe).
"""
import os
import json
import joblib
import numpy as np
import pandas as pd

ARTIFACTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "models", "artifacts"))

class MiningService:
    _CLASSIFIERS = None
    _ENCODERS = None
    _METRICS_CACHE = None
    _CONFUSION_CACHE = None
    _CLUSTERING_CACHE = None
    _APRIORI_CACHE = None

    @classmethod
    def _load_artifacts(cls):
        if cls._CLASSIFIERS is None:
            models_path = os.path.join(ARTIFACTS_DIR, "classifier_models.joblib")
            encoders_path = os.path.join(ARTIFACTS_DIR, "scaler_encoder.joblib")
            if os.path.exists(models_path) and os.path.exists(encoders_path):
                cls._CLASSIFIERS = joblib.load(models_path)
                cls._ENCODERS = joblib.load(encoders_path)

    @classmethod
    def get_model_comparison(cls):
        """Returns the 6-model benchmark comparison leaderboard and confusion matrices."""
        metrics_file = os.path.join(ARTIFACTS_DIR, "model_comparison_metrics.json")
        cm_file = os.path.join(ARTIFACTS_DIR, "confusion_matrices.json")

        if not os.path.exists(metrics_file):
            return {"error": "Model benchmarks not yet computed. Run training pipeline."}

        with open(metrics_file, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)

        cm_data = {}
        if os.path.exists(cm_file):
            with open(cm_file, "r", encoding="utf-8") as f:
                cm_data = json.load(f)

        return {
            "best_model": metrics_data.get("best_model"),
            "evaluation_criterion": metrics_data.get("evaluation_criterion"),
            "train_samples_count": metrics_data.get("train_samples_count"),
            "test_samples_count": metrics_data.get("test_samples_count"),
            "leaderboard": metrics_data.get("leaderboard", []),
            "confusion_matrices": cm_data
        }

    @classmethod
    def predict_popularity(cls, app_data, model_name=None):
        """Predicts the popularity tier for an individual app using intrinsic metadata."""
        cls._load_artifacts()
        if not cls._CLASSIFIERS or not cls._ENCODERS:
            return {"error": "Trained models not loaded."}

        if model_name is None or model_name not in cls._CLASSIFIERS:
            # Default to best model or Random Forest
            model_name = "Gradient Boosting" if "Gradient Boosting" in cls._CLASSIFIERS else list(cls._CLASSIFIERS.keys())[0]

        clf = cls._CLASSIFIERS[model_name]
        scaler = cls._ENCODERS["scaler"]
        cat_freq = cls._ENCODERS["cat_freq"]
        cr_freq = cls._ENCODERS["cr_freq"]

        # Parse inputs
        price = float(app_data.get("price", 0.0))
        size_mb = float(app_data.get("size_mb", 15.0))
        android_min = float(app_data.get("android_min_ver", 4.1))
        app_name = str(app_data.get("app_name", "My App")).strip()
        category = str(app_data.get("category", "GAME")).strip().upper()
        content_rating = str(app_data.get("content_rating", "Everyone")).strip()

        is_free_int = 1 if price == 0.0 else 0
        name_len = len(app_name)
        name_words = len(app_name.split())
        category_freq = cat_freq.get(category, 0.03)
        cr_freq_val = cr_freq.get(content_rating, 0.80)

        # Feature vector matching training order:
        # ["Price_USD", "size_imputed_mb", "Android_Min_Ver", "app_name_len", "app_name_words", "IsFree_int", "category_freq", "content_rating_freq"]
        feature_vec = np.array([[
            price, size_mb, android_min, name_len, name_words,
            is_free_int, category_freq, cr_freq_val
        ]])

        vec_scaled = scaler.transform(feature_vec)
        pred_class = int(clf.predict(vec_scaled)[0])

        probabilities = {}
        if hasattr(clf, "predict_proba"):
            probs = clf.predict_proba(vec_scaled)[0]
            tier_names = ["Low (<10k)", "Medium (10k-1M)", "High (>1M)"]
            for i, p in enumerate(probs):
                tier_label = tier_names[i] if i < len(tier_names) else f"Tier {i}"
                probabilities[tier_label] = round(float(p * 100), 2)

        tier_labels = {
            0: "Low Reach (< 10,000 installs)",
            1: "Medium Reach (10,000 - 1,000,000 installs)",
            2: "High / Viral Reach (> 1,000,000 installs)"
        }

        return {
            "model_used": model_name,
            "predicted_class": pred_class,
            "predicted_tier": tier_labels.get(pred_class, "Unknown"),
            "probabilities": probabilities,
            "input_features": {
                "category": category,
                "price": price,
                "size_mb": size_mb,
                "is_free": is_free_int == 1,
                "app_name": app_name,
                "content_rating": content_rating
            }
        }

    @classmethod
    def get_clustering_analysis(cls):
        """Returns K-Means elbow/silhouette curves and empirical cluster profiles."""
        c_file = os.path.join(ARTIFACTS_DIR, "clustering_results.json")
        if not os.path.exists(c_file):
            return {"error": "Clustering artifacts not found. Run training pipeline."}

        with open(c_file, "r", encoding="utf-8") as f:
            return json.load(f)

    @classmethod
    def get_apriori_rules(cls, min_lift=1.2, min_confidence=0.5, sort_by="lift"):
        """Returns mined association rules filtered by thresholds."""
        a_file = os.path.join(ARTIFACTS_DIR, "apriori_rules.json")
        if not os.path.exists(a_file):
            return {"error": "Apriori rules not found. Run training pipeline."}

        with open(a_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        rules = data.get("rules", [])
        # Filter rules
        filtered = [
            r for r in rules
            if r.get("lift", 0) >= min_lift and r.get("confidence", 0) >= min_confidence
        ]

        if sort_by == "confidence":
            filtered.sort(key=lambda r: r.get("confidence", 0), reverse=True)
        elif sort_by == "support":
            filtered.sort(key=lambda r: r.get("support", 0), reverse=True)
        else: # default lift
            filtered.sort(key=lambda r: r.get("lift", 0), reverse=True)

        return {
            "total_rules_mined": len(rules),
            "filtered_rules_count": len(filtered),
            "filters_applied": {
                "min_lift": min_lift,
                "min_confidence": min_confidence,
                "sort_by": sort_by
            },
            "rules": filtered
        }
