from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.database import init_db, close_db
from app.api import wizard
from app.api import locations
from app.api import document_processing
from app.api import campaign
from app.api import variants


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


settings = get_settings()

app = FastAPI(
    title="Marketing Agent v2",
    version="0.1.0",
    lifespan=lifespan,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded assets
static_dir = Path(__file__).resolve().parent.parent / "static" / "uploads"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir.parent)), name="static")

# Routes
app.include_router(wizard.router, prefix="/api/wizard", tags=["wizard"])
app.include_router(locations.router, prefix="/api/locations", tags=["locations"])
app.include_router(document_processing.router, prefix="/api/brand", tags=["brand"])
app.include_router(campaign.router, prefix="/api/campaign", tags=["campaign"])
app.include_router(variants.router, prefix="/api/variants", tags=["variants"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
