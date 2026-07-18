import base64
import logging
from pathlib import Path

from openai import APIError

from backend.config import BACKEND_DIR, get_settings
from backend.models import (
    ContentSlide,
    SlideImageGenerationRequest,
    SlideImageGenerationResponse,
    TitleSlide,
    generate_uuid,
)
from backend.openai_generation import GenerationError, _get_openai_client


logger = logging.getLogger(__name__)

GENERATED_IMAGES_DIR = BACKEND_DIR / "generated_images"

# Title and content slides share the same right-column image area (4:5).
_SLIDE_IMAGE_SIZE = {
    "title": "1024x1280",
    "content": "1024x1280",
}


class ImageGenerationError(GenerationError):
    """Raised when OpenAI image generation fails or returns invalid output."""


def ensure_generated_images_dir() -> Path:
    GENERATED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    return GENERATED_IMAGES_DIR


_IMAGE_PROMPT_INSTRUCTIONS = """\
Create one clean educational visual for middle-school students aged 12–15.
Match the requested aspect ratio and composition exactly.
Create one cohesive illustration or scene.
Do not create a collage, split screen, grid, poster, infographic, comic panels, \
or multiple framed images.
Communicate the central concept visually.
Use a modern, coherent educational illustration style.
Keep the composition clear and not overcrowded.
Keep important subjects within a generous central safe area.
Do not place essential visual information close to the edges.
Do not render words, captions, labels, letters, equations, logos, or watermarks.
Do not rely on text inside the image to explain the concept.
Avoid decorative imagery unrelated to the lesson.
Preserve factual accuracy.
"""


def _build_image_prompt(request: SlideImageGenerationRequest) -> str:
    slide = request.slide
    size = _SLIDE_IMAGE_SIZE[slide.type]

    context_lines = [
        f"Requested image size: {size}",
        "Requested aspect ratio: 4:5 portrait",
        f"Presentation title: {request.presentation_title}",
        f"Learning objective: {request.learning_objective}",
        f"Slide title: {slide.title}",
    ]

    if isinstance(slide, TitleSlide):
        if slide.subtitle:
            context_lines.append(f"Slide subtitle: {slide.subtitle}")
    elif isinstance(slide, ContentSlide):
        context_lines.append(f"Slide explanation: {slide.body}")
        for point in slide.bullet_points:
            context_lines.append(f"Slide point: {point}")

    context_block = "\n".join(context_lines)

    return (
        f"{_IMAGE_PROMPT_INSTRUCTIONS}\n"
        f"Lesson context:\n{context_block}"
    )


def generate_slide_image(
    request: SlideImageGenerationRequest,
) -> SlideImageGenerationResponse:
    settings = get_settings()
    image_size = _SLIDE_IMAGE_SIZE[request.slide.type]

    try:
        result = _get_openai_client().images.generate(
            model=settings.openai_image_model,
            prompt=_build_image_prompt(request),
            size=image_size,
            quality="low",
            output_format="webp",
        )
    except APIError as exc:
        logger.exception(
            "Image generation failed: OpenAI Image API request error"
        )
        raise ImageGenerationError(
            "OpenAI image generation failed. Please try again."
        ) from exc
    except GenerationError:
        logger.exception(
            "Image generation failed: OpenAI API request setup error"
        )
        raise
    except Exception as exc:
        logger.exception(
            "Image generation failed: unexpected error during the image request"
        )
        raise ImageGenerationError(
            "OpenAI image generation failed unexpectedly. Please try again."
        ) from exc

    if not result.data or not result.data[0].b64_json:
        logger.error("Image generation failed: missing image data in the response")
        raise ImageGenerationError(
            "OpenAI returned no image data. Please try again."
        )

    try:
        image_bytes = base64.b64decode(result.data[0].b64_json)
    except Exception as exc:
        logger.exception(
            "Image generation failed: could not decode the returned image data"
        )
        raise ImageGenerationError(
            "OpenAI returned invalid image data. Please try again."
        ) from exc

    filename = f"{generate_uuid()}.webp"

    try:
        images_dir = ensure_generated_images_dir()
        (images_dir / filename).write_bytes(image_bytes)
    except OSError as exc:
        logger.exception(
            "Image generation failed: could not save the generated image file"
        )
        raise ImageGenerationError(
            "The generated image could not be saved. Please try again."
        ) from exc

    return SlideImageGenerationResponse(
        slide_id=request.slide.id,
        image_url=f"/generated-images/{filename}",
    )
