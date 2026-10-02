"""
Generate realistic Google Play Store datasets for the dashboard.
Produces googleplaystore.csv and googleplaystore_user_reviews.csv
"""
import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import os

random.seed(42)
np.random.seed(42)

CATEGORIES = [
    "ART_AND_DESIGN", "AUTO_AND_VEHICLES", "BEAUTY", "BOOKS_AND_REFERENCE",
    "BUSINESS", "COMICS", "COMMUNICATION", "DATING", "EDUCATION", "ENTERTAINMENT",
    "EVENTS", "FINANCE", "FOOD_AND_DRINK", "HEALTH_AND_FITNESS", "HOUSE_AND_HOME",
    "LIBRARIES_AND_DEMO", "LIFESTYLE", "GAME", "FAMILY", "MEDICAL", "SOCIAL",
    "SHOPPING", "PHOTOGRAPHY", "SPORTS", "TRAVEL_AND_LOCAL", "TOOLS",
    "VIDEO_PLAYERS", "WEATHER", "PRODUCTIVITY", "MAPS_AND_NAVIGATION", "MUSIC_AND_AUDIO",
    "NEWS_AND_MAGAZINES", "PERSONALIZATION"
]

CONTENT_RATINGS = ["Everyone", "Everyone 10+", "Teen", "Mature 17+", "Adults only 18+", "Unrated"]
ANDROID_VERSIONS = ["2.3 and up", "4.0 and up", "4.0.3 and up", "4.1 and up", "4.2 and up",
                    "4.3 and up", "4.4 and up", "5.0 and up", "5.1 and up", "6.0 and up",
                    "7.0 and up", "8.0 and up", "Varies with device"]

APP_NAME_PREFIXES = [
    "Ultra", "Super", "Smart", "Quick", "Easy", "Pro", "Mega", "Fast", "Best", "Cool",
    "Amazing", "Awesome", "Perfect", "Free", "Top", "New", "Hot", "Live", "Mini", "Plus",
    "Max", "Go", "My", "One", "True", "Real", "Pure", "Daily", "Mobile", "Digital"
]
APP_NAME_ROOTS = [
    "Cam", "Photo", "Chat", "Messenger", "Launcher", "Cleaner", "Booster", "Keyboard",
    "VPN", "Browser", "Calculator", "Alarm", "Clock", "Notes", "Docs", "Sheets",
    "Translator", "Dictionary", "Reader", "Player", "Music", "Video", "Gallery",
    "Map", "GPS", "Weather", "News", "Shopping", "Finance", "Banking", "Scanner",
    "Editor", "Converter", "Manager", "Tracker", "Fitness", "Diet", "Recipe",
    "Travel", "Hotel", "Flight", "Game", "Puzzle", "Quiz", "Trivia", "Word",
    "Social", "Dating", "Story", "Podcast", "Radio", "Live", "Stream"
]

def generate_app_name():
    prefix = random.choice(APP_NAME_PREFIXES)
    root = random.choice(APP_NAME_ROOTS)
    suffix = random.choice(["", " Lite", " Pro", " Plus", " Free", " 2", " HD", " 3D", ""])
    return f"{prefix} {root}{suffix}"

def generate_installs():
    buckets = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000,
               1000000, 5000000, 10000000, 50000000, 100000000, 500000000, 1000000000]
    weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1]
    b = random.choices(buckets, weights=weights, k=1)[0]
    return f"{b:,}+"

def installs_to_int(s):
    return int(s.replace(",", "").replace("+", ""))

def generate_size():
    choices = [
        f"{random.randint(1, 99)}M",
        f"{random.randint(100, 999)}M",
        f"{random.randint(1, 99)}k",
        "Varies with device"
    ]
    weights = [50, 20, 15, 15]
    return random.choices(choices, weights=weights, k=1)[0]

def generate_price(is_free):
    if is_free:
        return "0"
    prices = [0.99, 1.49, 1.99, 2.49, 2.99, 3.49, 3.99, 4.49, 4.99, 5.99, 6.99, 7.99, 9.99, 14.99, 19.99]
    return f"${random.choice(prices)}"

def generate_date(start_year=2013, end_year=2018):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 8, 3)
    delta = end - start
    random_days = random.randint(0, delta.days)
    d = start + timedelta(days=random_days)
    return d.strftime("%-m/%d/%Y") if os.name != 'nt' else d.strftime("%#m/%d/%Y")

def generate_apps(n=10841):
    apps = []
    for i in range(n):
        is_free = random.random() < 0.85
        category = random.choice(CATEGORIES)
        installs_str = generate_installs()
        installs_val = installs_to_int(installs_str)

        # Rating correlated with installs
        base_rating = 3.5 + np.log10(max(installs_val, 1)) * 0.07
        rating = round(min(5.0, max(1.0, np.random.normal(base_rating, 0.5))), 1)

        reviews = int(installs_val * random.uniform(0.005, 0.1))
        reviews = max(1, reviews)

        android_ver = random.choice(ANDROID_VERSIONS)
        content_rating = random.choices(
            CONTENT_RATINGS,
            weights=[50, 15, 20, 10, 3, 2]
        )[0]

        # Introduce some nulls
        if random.random() < 0.02:
            rating = np.nan

        app = {
            "App": generate_app_name(),
            "Category": category,
            "Rating": rating,
            "Reviews": str(reviews),
            "Size": generate_size(),
            "Installs": installs_str,
            "Type": "Free" if is_free else "Paid",
            "Price": generate_price(is_free),
            "Content Rating": content_rating,
            "Genres": category.replace("_", " ").title(),
            "Last Updated": generate_date(),
            "Current Ver": f"{random.randint(1,9)}.{random.randint(0,9)}.{random.randint(0,9)}",
            "Android Ver": android_ver
        }
        apps.append(app)

    # Add the known malformed row (row 10472 in original)
    apps.append({
        "App": "Life Made WI-Fi Touchscreen Photo Frame",
        "Category": "1.9",
        "Rating": 19.0,
        "Reviews": "3.0M",
        "Size": "1,000+",
        "Installs": "Free",
        "Type": "0",
        "Price": "Everyone",
        "Content Rating": np.nan,
        "Genres": np.nan,
        "Last Updated": "February 11, 2018",
        "Current Ver": "4.0 and up",
        "Android Ver": np.nan
    })
    return pd.DataFrame(apps)

SENTIMENTS = ["Positive", "Negative", "Neutral"]
POSITIVE_REVIEWS = [
    "Love this app! Works perfectly.", "Amazing app, highly recommend!",
    "Best app I've ever used.", "Great features and design.", "Works like a charm.",
    "Very useful and easy to use.", "Excellent performance.", "5 stars easily.",
    "Absolutely fantastic.", "Clean UI and smooth experience.",
    "This app changed my life.", "Very intuitive interface.",
    "Couldn't be happier with this app.", "Top notch quality.",
    "Brilliant app, exactly what I needed."
]
NEGATIVE_REVIEWS = [
    "Terrible app, crashes constantly.", "Worst app ever, don't download.",
    "Full of bugs and ads.", "Waste of money.", "Doesn't work as advertised.",
    "Customer support is non-existent.", "Lost all my data.",
    "Too many permissions required.", "Horrible UI.", "App is broken.",
    "Constant crashes ruin the experience.", "Disappointing, expected more.",
    "Buggy and slow.", "Complete waste of time.",
    "Not worth the storage space."
]
NEUTRAL_REVIEWS = [
    "It's okay, nothing special.", "Average app.", "Does what it says.",
    "Could be better.", "Decent app.", "Some features work, others don't.",
    "Room for improvement.", "Gets the job done.", "Not bad but not great.",
    "Basic functionality is fine.", "Needs more updates.", "Works for basic use.",
    "Fair app for the price.", "Satisfactory.", "Medium experience."
]

def generate_reviews(apps_df, n_per_app_avg=8):
    reviews = []
    app_names = apps_df["App"].tolist()
    for app in random.choices(app_names, k=len(app_names) * n_per_app_avg):
        sentiment = random.choices(SENTIMENTS, weights=[60, 25, 15], k=1)[0]
        if sentiment == "Positive":
            text = random.choice(POSITIVE_REVIEWS)
            polarity = round(random.uniform(0.3, 1.0), 2)
            subjectivity = round(random.uniform(0.4, 1.0), 2)
        elif sentiment == "Negative":
            text = random.choice(NEGATIVE_REVIEWS)
            polarity = round(random.uniform(-1.0, -0.1), 2)
            subjectivity = round(random.uniform(0.4, 1.0), 2)
        else:
            text = random.choice(NEUTRAL_REVIEWS)
            polarity = round(random.uniform(-0.1, 0.3), 2)
            subjectivity = round(random.uniform(0.1, 0.5), 2)

        # Introduce some nulls
        if random.random() < 0.03:
            text = np.nan
            polarity = np.nan
            subjectivity = np.nan
            sentiment = np.nan

        reviews.append({
            "App": app,
            "Translated_Review": text,
            "Sentiment": sentiment,
            "Sentiment_Polarity": polarity,
            "Sentiment_Subjectivity": subjectivity
        })
    return pd.DataFrame(reviews)


if __name__ == "__main__":
    print("Generating app data...")
    apps_df = generate_apps(10841)
    # Add duplicates (about 1%)
    dup_indices = random.sample(range(len(apps_df)), 108)
    dups = apps_df.iloc[dup_indices].copy()
    apps_df = pd.concat([apps_df, dups], ignore_index=True)

    out_dir = os.path.dirname(os.path.abspath(__file__))
    apps_path = os.path.join(out_dir, "googleplaystore.csv")
    apps_df.to_csv(apps_path, index=False)
    print(f"Saved {len(apps_df)} rows to {apps_path}")

    print("Generating user reviews...")
    reviews_df = generate_reviews(apps_df)
    reviews_path = os.path.join(out_dir, "googleplaystore_user_reviews.csv")
    reviews_df.to_csv(reviews_path, index=False)
    print(f"Saved {len(reviews_df)} rows to {reviews_path}")
    print("Done!")
