import sqlite3
import json
import os
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'recipes.db')
JSON_SEED_PATH = os.path.join(os.path.dirname(__file__), 'recipes_db.json')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                cuisine TEXT DEFAULT '',
                base_yield REAL NOT NULL DEFAULT 100.0,
                yield_unit TEXT NOT NULL DEFAULT 'Kg',
                instructions TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id TEXT NOT NULL,
                name TEXT NOT NULL,
                stage TEXT DEFAULT 'Main',
                quantity REAL NOT NULL DEFAULT 0.0,
                unit TEXT DEFAULT 'gm',
                notes TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_recipes_cat ON recipes(category)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ingr_recipe ON ingredients(recipe_id)")
        
        # Check if database is empty, seed from recipes_db.json if available
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM recipes")
        count = cur.fetchone()[0]
        if count == 0 and os.path.exists(JSON_SEED_PATH):
            print("Seeding database from recipes_db.json...")
            with open(JSON_SEED_PATH, 'r', encoding='utf-8') as f:
                seed_data = json.load(f)
            now = datetime.utcnow().isoformat()
            for r in seed_data:
                r_id = r.get('id') or str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO recipes (id, title, category, cuisine, base_yield, yield_unit, instructions, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    r_id,
                    r.get('title', 'Untitled Recipe'),
                    r.get('category', 'General'),
                    r.get('cuisine', ''),
                    float(r.get('base_yield', 100.0)),
                    r.get('yield_unit', 'Kg'),
                    json.dumps(r.get('instructions', [])),
                    now,
                    now
                ))
                for idx, ing in enumerate(r.get('ingredients', [])):
                    cur.execute("""
                        INSERT INTO ingredients (recipe_id, name, stage, quantity, unit, notes, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r_id,
                        ing.get('name', ''),
                        ing.get('stage', 'Main') or 'Main',
                        float(ing.get('quantity', 0.0)) if ing.get('quantity') is not None else 0.0,
                        ing.get('unit', 'gm') or 'gm',
                        ing.get('notes', '') or '',
                        idx
                    ))
            print(f"Seeded {len(seed_data)} recipes into SQLite database.")

def get_stats():
    conn = get_connection()
    with conn:
        total_recipes = conn.execute("SELECT COUNT(*) FROM recipes").fetchone()[0]
        total_categories = conn.execute("SELECT COUNT(DISTINCT category) FROM recipes").fetchone()[0]
        total_ingredients = conn.execute("SELECT COUNT(*) FROM ingredients").fetchone()[0]
        avg_ingredients = round(total_ingredients / total_recipes, 1) if total_recipes > 0 else 0
        return {
            'total_recipes': total_recipes,
            'total_categories': total_categories,
            'total_ingredients': total_ingredients,
            'avg_ingredients_per_recipe': avg_ingredients
        }

def get_categories():
    conn = get_connection()
    with conn:
        rows = conn.execute("""
            SELECT category, COUNT(*) as recipe_count,
                   (SELECT COUNT(*) FROM ingredients i JOIN recipes r2 ON i.recipe_id = r2.id WHERE r2.category = r.category) as ingredient_count
            FROM recipes r
            GROUP BY category
            ORDER BY category ASC
        """).fetchall()
        return [dict(r) for r in rows]

def list_recipes(search='', category='', limit=200, offset=0):
    conn = get_connection()
    with conn:
        query = """
            SELECT r.*, COUNT(i.id) as ingredients_count
            FROM recipes r
            LEFT JOIN ingredients i ON r.id = i.recipe_id
            WHERE 1=1
        """
        params = []
        if category and category.lower() != 'all':
            query += " AND r.category = ?"
            params.append(category)
        if search:
            query += " AND (r.title LIKE ? OR r.cuisine LIKE ? OR EXISTS (SELECT 1 FROM ingredients i2 WHERE i2.recipe_id = r.id AND i2.name LIKE ?))"
            s_param = f"%{search.strip()}%"
            params.extend([s_param, s_param, s_param])
            
        query += " GROUP BY r.id ORDER BY r.title ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        rows = conn.execute(query, params).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            try:
                d['instructions'] = json.loads(d['instructions'])
            except:
                d['instructions'] = []
            result.append(d)
        return result

def get_recipe(recipe_id):
    conn = get_connection()
    with conn:
        r_row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
        if not r_row:
            return None
        recipe = dict(r_row)
        try:
            recipe['instructions'] = json.loads(recipe['instructions'])
        except:
            recipe['instructions'] = []
            
        ing_rows = conn.execute("""
            SELECT id, name, stage, quantity, unit, notes
            FROM ingredients
            WHERE recipe_id = ?
            ORDER BY sort_order ASC, id ASC
        """, (recipe_id,)).fetchall()
        
        recipe['ingredients'] = [dict(i) for i in ing_rows]
        recipe['ingredients_count'] = len(recipe['ingredients'])
        return recipe

def create_recipe(data):
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    recipe_id = data.get('id') or f"custom_{uuid.uuid4().hex[:8]}"
    instructions = data.get('instructions', [])
    if isinstance(instructions, str):
        instructions = [i.strip() for i in instructions.split('\n') if i.strip()]
        
    with conn:
        conn.execute("""
            INSERT INTO recipes (id, title, category, cuisine, base_yield, yield_unit, instructions, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            recipe_id,
            data.get('title', 'Untitled Recipe').strip(),
            data.get('category', 'General').strip(),
            data.get('cuisine', '').strip(),
            float(data.get('base_yield', 100.0)),
            data.get('yield_unit', 'Kg').strip() or 'Kg',
            json.dumps(instructions),
            now,
            now
        ))
        
        ingredients = data.get('ingredients', [])
        for idx, ing in enumerate(ingredients):
            conn.execute("""
                INSERT INTO ingredients (recipe_id, name, stage, quantity, unit, notes, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                recipe_id,
                ing.get('name', '').strip(),
                ing.get('stage', 'Main').strip() or 'Main',
                float(ing.get('quantity', 0.0)) if ing.get('quantity') is not None else 0.0,
                ing.get('unit', 'gm').strip() or 'gm',
                ing.get('notes', '').strip() or '',
                idx
            ))
            
    return get_recipe(recipe_id)

def update_recipe(recipe_id, data):
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    instructions = data.get('instructions', [])
    if isinstance(instructions, str):
        instructions = [i.strip() for i in instructions.split('\n') if i.strip()]

    with conn:
        conn.execute("""
            UPDATE recipes
            SET title = ?, category = ?, cuisine = ?, base_yield = ?, yield_unit = ?, instructions = ?, updated_at = ?
            WHERE id = ?
        """, (
            data.get('title', 'Untitled Recipe').strip(),
            data.get('category', 'General').strip(),
            data.get('cuisine', '').strip(),
            float(data.get('base_yield', 100.0)),
            data.get('yield_unit', 'Kg').strip() or 'Kg',
            json.dumps(instructions),
            now,
            recipe_id
        ))
        
        # Replace ingredients
        conn.execute("DELETE FROM ingredients WHERE recipe_id = ?", (recipe_id,))
        ingredients = data.get('ingredients', [])
        for idx, ing in enumerate(ingredients):
            conn.execute("""
                INSERT INTO ingredients (recipe_id, name, stage, quantity, unit, notes, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                recipe_id,
                ing.get('name', '').strip(),
                ing.get('stage', 'Main').strip() or 'Main',
                float(ing.get('quantity', 0.0)) if ing.get('quantity') is not None else 0.0,
                ing.get('unit', 'gm').strip() or 'gm',
                ing.get('notes', '').strip() or '',
                idx
            ))
            
    return get_recipe(recipe_id)

def delete_recipe(recipe_id):
    conn = get_connection()
    with conn:
        conn.execute("DELETE FROM ingredients WHERE recipe_id = ?", (recipe_id,))
        cur = conn.execute("DELETE FROM recipes WHERE id = ?", (recipe_id,))
        return cur.rowcount > 0

def scale_recipe_data(recipe, target_yield):
    base_yield = float(recipe.get('base_yield', 100.0))
    target = float(target_yield)
    scale_factor = target / base_yield if base_yield > 0 else 1.0
    
    scaled_recipe = dict(recipe)
    scaled_recipe['scaled_yield'] = target
    scaled_recipe['scale_factor'] = round(scale_factor, 4)
    
    scaled_ingredients = []
    for ing in recipe.get('ingredients', []):
        s_ing = dict(ing)
        base_qty = float(ing.get('quantity', 0.0))
        scaled_qty = round(base_qty * scale_factor, 3)
        s_ing['base_quantity'] = base_qty
        s_ing['scaled_quantity'] = scaled_qty
        scaled_ingredients.append(s_ing)
        
    scaled_recipe['ingredients'] = scaled_ingredients
    return scaled_recipe

if __name__ == '__main__':
    init_db()
    stats = get_stats()
    print("Database ready. Stats:", stats)
