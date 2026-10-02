# Google Play Store BI Dashboard

A full-stack, interactive **Data Mining & Business Intelligence Dashboard** for the Google Play Store dataset — built with **Flask** (backend) and **HTML/CSS/JS + Chart.js** (frontend).

---

## 📁 Project Structure

```
PlaystoreProject/
├── data/
│   ├── googleplaystore.csv           ← Main app dataset (10,841 rows)
│   └── googleplaystore_user_reviews.csv  ← User reviews (57K+ rows)
├── backend/
│   └── app.py                        ← Flask API (all endpoints)
├── frontend/
│   ├── index.html                    ← Dashboard UI
│   ├── style.css                     ← Dark/light theme, glassmorphism
│   └── app.js                        ← Chart.js, filters, mining
├── requirements.txt
└── README.md
```

---

## ⚙️ Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Download NLTK data (one-time, auto-runs on first start)
The backend auto-downloads `punkt` and `stopwords` on first launch.

### 3. Start the backend
```bash
cd backend
python app.py
```
The API runs at **http://127.0.0.1:5000**

### 4. Open the frontend
Open `frontend/index.html` in your browser — **no build step needed**.

> **Note**: The frontend makes API calls to `http://127.0.0.1:5000`. Ensure the backend is running first.

---

## 🌟 Features

### Global Filters (all charts update live)
| Filter | Description |
|--------|-------------|
| **Time Range** | Last 1/3/6/12 months or custom date range (relative to dataset max date) |
| **Category** | Multi-select dropdown with all 33 categories |
| **Type** | Free / Paid |
| **Content Rating** | Everyone, Teen, Mature 17+, etc. |
| **Rating Range** | Dual slider (1.0–5.0) |
| **Android Version** | Dropdown |
| **App Search** | Live text search on app name |

### KPI Tiles (with δ vs previous period)
- Total Apps · Avg Rating · Total Installs · Total Reviews
- % Free · Avg Price (Paid) · Apps Updated in Period · Top Category

### Charts (11 interactive charts)
- Apps per Category (bar, click to filter)
- Installs by Category (bar)
- Rating Distribution (histogram)
- Free vs Paid (donut)
- Apps Updated per Month (line)
- Top 10 Apps by Installs (bar)
- Price vs Rating — paid apps only (scatter)
- Reviews vs Installs (scatter, color by category)
- Content Rating Share (donut, click to filter)
- Android Version Distribution (bar)
- Category × Rating Heatmap (HTML table with intensity coloring)

### Data Mining Section (4 tabs)
| Tab | Contents |
|-----|----------|
| **Sentiment Analysis** | Overall +/−/neutral donut; per-category stacked bar; interactive word cloud |
| **K-Means Clustering** | 5-cluster scatter (Rating vs Installs) with cluster labels |
| **Association Insights** | Category associations: paid trends, high-rated, top installs |
| **Predictive Model** | Random Forest predicting high-rated (≥4.3); accuracy + feature importance chart |

### UX
- 🌙/☀️ Dark/light theme toggle
- ↓ Export filtered data to CSV
- 💡 Auto-generated insights panel
- Drill-down: click bar/donut segments to apply as filter
- Tooltips on all interactive elements
- Responsive layout (sidebar collapses on mobile)

---

## 🔌 API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/meta` | Filter options (categories, content ratings, Android versions) |
| `GET /api/kpis` | All KPI tiles with delta vs previous period |
| `GET /api/charts/apps_per_category` | App count by category |
| `GET /api/charts/installs_by_category` | Total installs by category |
| `GET /api/charts/rating_distribution` | Histogram data |
| `GET /api/charts/free_vs_paid` | Free/paid counts |
| `GET /api/charts/apps_updated_per_month` | Monthly update counts |
| `GET /api/charts/top10_by_installs` | Top 10 apps by installs |
| `GET /api/charts/price_vs_rating` | Paid apps scatter data |
| `GET /api/charts/reviews_vs_installs` | Reviews/installs scatter |
| `GET /api/charts/content_rating_share` | Content rating distribution |
| `GET /api/charts/android_version_dist` | Android version distribution |
| `GET /api/charts/category_rating_heatmap` | Heatmap pivot data |
| `GET /api/mining/sentiment` | Sentiment analysis + word cloud |
| `GET /api/mining/clustering` | K-Means cluster data |
| `GET /api/mining/association` | Association insights |
| `GET /api/mining/ml_model` | Random Forest results |
| `GET /api/insights` | Auto-generated text insights |
| `GET /api/export` | Download filtered CSV |

All endpoints accept the same query parameters as the frontend filters.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, Flask, pandas, scikit-learn, NLTK |
| Frontend | HTML5, Vanilla CSS, JavaScript (ES2020) |
| Charts | Chart.js 4.4 |
| ML | K-Means, Random Forest (scikit-learn) |
| NLP | NLTK stopwords + regex word frequency |
