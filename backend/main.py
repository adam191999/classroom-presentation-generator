from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.mock_generation import (
    generate_mock_outline,
    generate_mock_presentation,
    generate_mock_slide,
)
from backend.models import (
    LessonBrief,
    Presentation,
    PresentationOutline,
    PresentationSlide,
    SlideGenerationRequest,
)
from backend.openai_generation import (
    OutlineGenerationError,
    generate_openai_outline,
)


app = FastAPI(
    title="Lamma Lesson Generator API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/outlines/generate", response_model=PresentationOutline)
def generate_outline(brief: LessonBrief) -> PresentationOutline:
    settings = get_settings()

    if settings.generation_provider == "mock":
        return generate_mock_outline(brief)

    try:
        return generate_openai_outline(brief)
    except OutlineGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/presentations/generate", response_model=Presentation)
def generate_presentation(outline: PresentationOutline) -> Presentation:
    return generate_mock_presentation(outline)


@app.post("/api/slides/generate", response_model=PresentationSlide)
def generate_slide(request: SlideGenerationRequest) -> PresentationSlide:
    return generate_mock_slide(request)
