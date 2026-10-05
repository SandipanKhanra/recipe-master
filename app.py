import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

import database
from pdf_service import generate_recipe_pdf

app = FastAPI(
    title="Recipe Master API",
    description="Institutional Recipe Management, Dynamic Yield Scaling & PDF Export Platform",
    version="2.0.0"
)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    database.init_db()

# Pydantic Schemas
class IngredientSchema(BaseModel):
    name: str = Field(..., example="Toor Dal")
    stage: str = Field("Main", example="Main")
    quantity: float = Field(0.0, example=5.0)
    unit: str = Field("Kg", example="Kg")
    notes: Optional[str] = Field("", example="Soak overnight")

class RecipeCreateSchema(BaseModel):
    title: str = Field(..., example="Dal Makhani")
    category: str = Field(..., example="Dal")
    cuisine: Optional[str] = Field("", example="North Indian")
    base_yield: float = Field(100.0, example=100.0)
    yield_unit: str = Field("L", example="L")
    ingredients: List[IngredientSchema] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)

class RecipeUpdateSchema(BaseModel):
    title: str
    category: str
    cuisine: Optional[str] = ""
    base_yield: float = 100.0
    yield_unit: str = "Kg"
    ingredients: List[IngredientSchema] = []
    instructions: List[str] = []

# API Endpoints
@app.get("/api/stats")
def get_stats():
    return database.get_stats()

@app.get("/api/categories")
def get_categories():
    return database.get_categories()

@app.get("/api/recipes")
def get_recipes(
    search: Optional[str] = Query("", description="Search by title, cuisine, or ingredient"),
    category: Optional[str] = Query("all", description="Filter by category"),
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    recipes = database.list_recipes(search=search, category=category, limit=limit, offset=offset)
    return {
        "count": len(recipes),
        "recipes": recipes
    }

@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: str):
    recipe = database.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@app.get("/api/recipes/{recipe_id}/scale")
def scale_recipe(recipe_id: str, target_yield: float = Query(..., gt=0)):
    recipe = database.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return database.scale_recipe_data(recipe, target_yield)

@app.get("/api/recipes/{recipe_id}/pdf")
def download_recipe_pdf(recipe_id: str, target_yield: Optional[float] = None):
    recipe = database.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    yield_val = target_yield if target_yield and target_yield > 0 else recipe.get("base_yield", 100.0)
    pdf_bytes = generate_recipe_pdf(recipe, target_yield=yield_val)
    
    clean_title = "".join(c for c in recipe.get("title", "recipe") if c.isalnum() or c in (" ", "_", "-")).rstrip()
    filename = f"{clean_title}_{yield_val:g}{recipe.get('yield_unit', '')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.post("/api/recipes", status_code=201)
def create_recipe(data: RecipeCreateSchema):
    recipe_dict = data.model_dump()
    created = database.create_recipe(recipe_dict)
    return created

@app.put("/api/recipes/{recipe_id}")
def update_recipe(recipe_id: str, data: RecipeUpdateSchema):
    recipe = database.get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    updated = database.update_recipe(recipe_id, data.model_dump())
    return updated

@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: str):
    success = database.delete_recipe(recipe_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted successfully"}

# Static files and root route
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)

NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
}

# Fallback direct routes so root /style.css, /app.js, /recipes_data.js always work
@app.get("/style.css")
def get_root_style():
    return FileResponse(os.path.join(STATIC_DIR, "style.css"), media_type="text/css", headers=NO_CACHE_HEADERS)

@app.get("/app.js")
def get_root_app():
    return FileResponse(os.path.join(STATIC_DIR, "app.js"), media_type="application/javascript", headers=NO_CACHE_HEADERS)

@app.get("/recipes_data.js")
def get_root_recipes_data():
    return FileResponse(os.path.join(STATIC_DIR, "recipes_data.js"), media_type="application/javascript", headers=NO_CACHE_HEADERS)

@app.get("/translations.js")
def get_root_translations():
    return FileResponse(os.path.join(STATIC_DIR, "translations.js"), media_type="application/javascript", headers=NO_CACHE_HEADERS)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
def index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content, headers=NO_CACHE_HEADERS)
    return "<h1>Recipe Master API is running. UI loading...</h1>"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
