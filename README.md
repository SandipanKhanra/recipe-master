# 🌿 Recipe Master (RM 2019)

> **Institutional Kitchen Recipe Backbone, Dynamic Yield Scaling & PDF Export Platform (100% Vegetarian)**

Recipe Master is a high-performance web platform and responsive application built on the **RM 2019 Institutional Recipe Master Workbook** (`RM 2019_v2.xlsx`). It converts an intricate, 13,000+ row institutional catering spreadsheet into a lightning-fast, responsive web interface and REST API.

---

## 🌟 Key Features

1. **Complete Excel Backbone Ingestion**:
   - Analyzed and parsed **446 production-tested recipes** across **19 culinary categories**.
   - Structured **6,571 ingredients** with quantities, units, preparation stages (*Main, Chaunk / Tadka, Paste, Seasoning, Garnish*), and chef instructions.
   - Preserves institutional culinary standards and notes from master cooks.

2. **Prominent & Readable Ingredients Count**:
   - **Recipe Cards**: Instant badge on every card highlighting total ingredients count (e.g. `🥣 14 Ingredients`).
   - **Interactive Recipe View**: High-visibility hero banner displaying the exact ingredient count and stage breakdown (e.g. `14 Total Ingredients • 4 Main • 4 Tadka • 3 Paste • 3 Seasoning`).
   - **Recipe Creator / Editor**: Real-time live counter (`Ingredients Count: X`) that automatically increments as you add or remove rows.

3. **Dynamic Institutional Yield Scaler**:
   - Faithful implementation of the Excel backbone scaling formula:
     $$\text{Scaled Quantity} = \text{Base Quantity} \times \left(\frac{\text{Target Yield}}{\text{Base Yield}}\right)$$
   - Interactive slider and target yield number input.
   - Quick multiplier chips (`0.25x`, `0.5x`, `1x (Base)`, `2x`, `5x`, `10x`).
   - Real-time recalculation of every ingredient with unit formatting.

4. **Kitchen-Ready PDF Export & Printing**:
   - **Server-Side ReportLab Engine**: Generates clean, publication-quality printable PDF recipe sheets at the exact target scaled yield with a single click.
   - Includes **[ ] Mise-en-place check squares** for kitchen staff staging.
   - Displays recipe metadata, scaled yield, batch scale factor, ingredient table, and numbered cooking instructions.
   - Dedicated print styling (`@media print`) for browser printing to standard printers.

5. **Easy Recipe Creation & Management**:
   - Intuitive modal to add brand new recipes with dynamic ingredients rows.
   - Auto-categorization into the 19 standard categories or custom categories.
   - Full CRUD capability (Create, Read, Update, Delete) with SQLite persistence.

6. **Free-Tier Cloud Hosting Ready**:
   - Python backend powered by **FastAPI** + **Uvicorn** + **SQLite**.
   - Zero external database requirements or paid database add-ons.
   - Ready for instant deployment on **Render.com** (Free Web Service), **Railway.app**, **Hugging Face Spaces**, **Fly.io**, or **PythonAnywhere**.

---

## 📊 Spreadsheet Analysis Summary

| Category | Recipe Count | Total Ingredients | Common Base Units | Typical Preparation Stages |
| :--- | :---: | :---: | :---: | :--- |
| **Wet Subjis** | 68 | 1,180 | 100 L | Boil / Fry / Chaunk / Paste / Gravy |
| **Sweets** | 55 | 694 | 45 – 100 L / Kg | Boiling / Roasting / Khoya / Garnish |
| **Breakfast Items** | 51 | 812 | 100 L / Nos | Soaking / Batter / Steaming / Tadka |
| **Rice / Biryani** | 41 | 632 | 60 – 195 L | Washing / Direct Chaunk / Dum / Boil |
| **Dry Subji's** | 33 | 468 | 100 L / Kg | Roasting / Tadka / Seasoning / Cover & Cook |
| **Dal & Amti** | 26 | 398 | 45 – 100 L | Overnight Soak / Pressure Cook / Chaunk |
| **Ekadashi** | 26 | 382 | 60 – 180 L | Varai / Sabudana / Ghee / Sendha Namak |
| **Beverages** | 24 | 167 | 100 L | Pulping / Boiling / Chilling / Spicing |
| **FHC Sabjis** | 24 | 362 | 100 L | Cut Vegetables / Gravy Base / Simmer |
| **Fried Items / Farsan** | 17 | 258 | 50 – 2000 Nos | Batter / Deep Frying / Masala Coating |
| **Soups & Salads** | 14 | 196 | 100 L | Puree / Boiling / Butter / Seasoning |
| **Chutneys** | 14 | 146 | 10 – 60 L | Grinding / Thick & Thin / Tadka |
| **Sweets Sustainable** | 12 | 164 | 36 – 90 Kg / L | Low-cost Bulk Batches / Burfi / Laddu |
| **Khichadi** | 10 | 158 | 30 – 100 L | Dal-Rice Boil / Vegetable Addition / Ghee Chaunk |
| **Roti & Paratha** | 5 | 86 | 420 – 600 pcs | Dough Mixing (Atta:Alu) / Rolling / Tava Roast |
| **Masalas (Spice Blends)** | 8 | 92 | 1000 – 2000 gm | Roasting / Dry Grinding / Seiving |
| **Economical Recipes** | 7 | 84 | 60 – 100 L | Optimized Dal / Halva / Pongal |
| **Kadhi & Raita** | 6 | 72 | 50 – 100 L | Dahi-Besan Whisk / Pakoda / Tadka |
| **Jam & Pickles** | 5 | 60 | 8 – 20 L / Kg | Pulp Reduction / Spices / Oil Sealing |
| **Total** | **446 Recipes** | **6,571 Ingredients** | — | **~14.7 ingredients / recipe** |

---

## 🚀 Quickstart (Local Run)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Initialize Database & Seed from Excel Extract
```bash
python database.py
```

### 3. Launch the Server
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
Open **`http://localhost:8000`** in your browser.

---

## 🌐 Free Hosting Deployment Guides

### Option 1: Render.com (Recommended — 100% Free Web Service)
1. Push this repository to your **GitHub** account.
2. Log into [Render.com](https://render.com) and click **New +** → **Web Service**.
3. Select your repository.
4. Render will automatically detect `render.yaml` or you can configure manually:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && python database.py`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. Click **Create Web Service**. Your app is live with free HTTPS at `https://recipe-master.onrender.com`!

### Option 2: Railway.app / Fly.io / Hugging Face Spaces (Docker Free Tier)
This repository includes a production-ready `Dockerfile`:
```bash
# Hugging Face Spaces:
# Create a new Space -> SDK: Docker -> Connect Repo -> Done!

# Fly.io:
fly launch
fly deploy
```

### Option 3: PythonAnywhere (Free Python Web App)
1. Create a free account on [PythonAnywhere.com](https://www.pythonanywhere.com/).
2. Open a Bash console and clone the repository.
3. Create a virtualenv: `mkvirtualenv --python=/usr/bin/python3.9 recipe-env && pip install -r requirements.txt`.
4. In the **Web** tab, configure the WSGI configuration to point to `app:app` (via ASGI wrapper or Uvicorn).

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/` | `GET` | Responsive Web Application UI |
| `/api/stats` | `GET` | Database summary (Total recipes, categories, ingredients count) |
| `/api/categories` | `GET` | All 19 categories with recipe counts and total ingredients |
| `/api/recipes` | `GET` | List recipes with search (`?search=`), category filter (`?category=`), sort, and pagination |
| `/api/recipes/{id}` | `GET` | Full recipe details including all ingredient stages and instructions |
| `/api/recipes/{id}/scale` | `GET` | Dynamic yield scaling calculator (`?target_yield=50`) |
| `/api/recipes/{id}/pdf` | `GET` | Download dynamically generated ReportLab PDF (`?target_yield=50`) |
| `/api/recipes` | `POST` | Create a new recipe with dynamic ingredients list |
| `/api/recipes/{id}` | `PUT` | Update an existing recipe |
| `/api/recipes/{id}` | `DELETE` | Delete recipe |
