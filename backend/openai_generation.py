from openai import APIError, OpenAI

from backend.ai_schemas import AIOutline
from backend.config import get_settings
from backend.lesson_structure import slide_types_for_duration
from backend.models import (
    LessonBrief,
    OutlineSlide,
    PresentationOutline,
    generate_uuid,
)


class OutlineGenerationError(Exception):
    """Raised when OpenAI outline generation fails or returns invalid output."""


_client: OpenAI | None = None


def _get_openai_client() -> OpenAI:
    global _client

    if _client is None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise OutlineGenerationError(
                "OpenAI API key is not configured. Set OPENAI_API_KEY in backend/.env."
            )
        _client = OpenAI(api_key=settings.openai_api_key)

    return _client


_SYSTEM_INSTRUCTIONS = """\
You are helping a middle-school teacher create a short classroom lesson outline \
for students aged approximately 12–15.

Create a short, coherent, interactive classroom lesson outline.
Write in the same language as the teacher’s prompt.
Match the requested lesson duration.
Follow the exact ordered slide structure supplied by the application.
Each content slide introduces one focused idea.
Each multiple-choice slide checks understanding of the content immediately before it.
The opening discussion should activate curiosity or intuition.
The summary should consolidate the central ideas and end with reflection.
Keep the plan age-appropriate, accurate, and concise.
Do not include image URLs.
Do not invent additional slides.

Treat content_summary as a concise planning outline for the later full-presentation \
generation step. Use 1–3 short planning bullets per slide when possible. Do not \
write final polished slide copy. Do not include the lesson duration as slide content. \
Do not repeat labels such as "title slide" or the slide type.

For each required slide type:
- title: Describe the framing or opening idea; do not include duration metadata.
- discussion: Describe the discussion goal and central question idea; do not fully \
script the classroom activity.
- content: List the concepts, explanation, or example that the final slide should cover.
- multiple_choice: Describe what understanding should be checked and, optionally, \
the misconception to test. Do not generate answer options, lettered choices, or the \
correct answer at outline stage.
- summary: Describe the key ideas to recap and the purpose of the exit question; do \
not write the final wording yet.

Return only planning content for the required number of slides, in order. Do not \
choose slide types or invent IDs — the application owns those.
"""


def _build_user_input(brief: LessonBrief, slide_type_values: list[str]) -> str:
    ordered_structure = "\n".join(
        f"{index}. {slide_type}"
        for index, slide_type in enumerate(slide_type_values, start=1)
    )

    return (
        f"Teacher prompt:\n{brief.prompt}\n\n"
        f"Lesson duration: {brief.duration_minutes} minutes\n\n"
        f"Required ordered slide structure ({len(slide_type_values)} slides):\n"
        f"{ordered_structure}\n\n"
        "Generate one slide content entry for each position above, in the same order."
    )


def generate_openai_outline(brief: LessonBrief) -> PresentationOutline:
    settings = get_settings()
    required_types = slide_types_for_duration(brief.duration_minutes)
    slide_type_values = [slide_type.value for slide_type in required_types]

    try:
        response = _get_openai_client().responses.parse(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": _SYSTEM_INSTRUCTIONS,
                },
                {
                    "role": "user",
                    "content": _build_user_input(brief, slide_type_values),
                },
            ],
            text_format=AIOutline,
        )
    except APIError as exc:
        raise OutlineGenerationError(
            "OpenAI outline generation failed. Please try again."
        ) from exc
    except OutlineGenerationError:
        raise
    except Exception as exc:
        raise OutlineGenerationError(
            "OpenAI outline generation failed unexpectedly. Please try again."
        ) from exc

    parsed = response.output_parsed
    if parsed is None:
        raise OutlineGenerationError(
            "OpenAI returned no structured outline. Please try again."
        )

    if len(parsed.slides) != len(required_types):
        raise OutlineGenerationError(
            "OpenAI returned an outline with the wrong number of slides. "
            f"Expected {len(required_types)}, got {len(parsed.slides)}."
        )

    slides = [
        OutlineSlide(
            id=generate_uuid(),
            type=slide_type,
            title=ai_slide.title,
            content_summary=ai_slide.content_summary,
        )
        for slide_type, ai_slide in zip(required_types, parsed.slides, strict=True)
    ]

    return PresentationOutline(
        title=parsed.title,
        learning_objective=parsed.learning_objective,
        slides=slides,
    )
