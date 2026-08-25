from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.image_generation import (
    ensure_generated_images_dir,
    generate_slide_image,
)
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
    SlideImageGenerationRequest,
    SlideImageGenerationResponse,
)
from backend.openai_generation import (
    GenerationError,
    generate_openai_outline,
    generate_openai_presentation,
    generate_openai_slide,
)


app = FastAPI(
    title="Classroom Presentation Generator API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/generated-images",
    StaticFiles(directory=ensure_generated_images_dir()),
    name="generated-images",
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
    except GenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/presentations/generate", response_model=Presentation)
def generate_presentation(outline: PresentationOutline) -> Presentation:
    settings = get_settings()

    if settings.generation_provider == "mock":
        return generate_mock_presentation(outline)

    try:
        return generate_openai_presentation(outline)
    except GenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/slides/generate", response_model=PresentationSlide)
def generate_slide(request: SlideGenerationRequest) -> PresentationSlide:
    settings = get_settings()

    if settings.generation_provider == "mock":
        return generate_mock_slide(request)

    try:
        return generate_openai_slide(request)
    except GenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/images/generate", response_model=SlideImageGenerationResponse)
def generate_image(
    request: SlideImageGenerationRequest,
) -> SlideImageGenerationResponse:
    settings = get_settings()

    if settings.generation_provider != "openai":
        raise HTTPException(
            status_code=503,
            detail=(
                "Image generation requires the OpenAI provider. "
                "Set GENERATION_PROVIDER=openai in backend/.env."
            ),
        )

    try:
        return generate_slide_image(request)
    except GenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
