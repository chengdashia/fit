import sys
from pathlib import Path

# 允许直接运行 python app/main.py
if __name__ == "__main__" and __package__ is None:
    sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)
from app.api import auth, user, home, diet, weight, training

settings = get_settings()

def _seed_foods_if_empty():
    try:
        from app.core.database import SessionLocal
        from app.models.diet import FoodDatabase
        db = SessionLocal()
        try:
            count = db.query(FoodDatabase).count()
        finally:
            db.close()
        if count == 0:
            import sys
            from pathlib import Path
            backend_root = Path(__file__).parent.parent
            if str(backend_root) not in sys.path:
                sys.path.insert(0, str(backend_root))
            from scripts.seed_foods import seed
            seed()
    except Exception:
        pass

if settings.AUTO_CREATE_TABLES:
    Base.metadata.create_all(bind=engine)

if settings.SEED_FOODS_ON_STARTUP:
    _seed_foods_if_empty()

app = FastAPI(title=settings.APP_NAME, version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
from fastapi.exceptions import RequestValidationError
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(user.router, prefix="/api/user", tags=["user"])
app.include_router(home.router, prefix="/api/home", tags=["home"])
app.include_router(diet.router, prefix="/api/diet", tags=["diet"])
app.include_router(weight.router, prefix="/api/weight", tags=["weight"])
app.include_router(training.router, prefix="/api/training", tags=["training"])


@app.get("/api/health")
def health_check():
    return {"code": 0, "message": "success", "data": {"status": "ok"}}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
