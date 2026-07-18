import logging
from typing import NoReturn

from openai import APIError, OpenAI
from pydantic import ValidationError

from backend.ai_schemas import (
    AIContentSlideContent,
    AIDiscussionSlideContent,
    AIMultipleChoiceSlideContent,
    AIOutline,
    AIPresentationContent,
    AISummarySlideContent,
    AITitleSlideContent,
)
from backend.config import get_settings
from backend.lesson_structure import slide_types_for_duration
from backend.models import (
    ContentSlide,
    DiscussionSlide,
    LessonBrief,
    MultipleChoiceSlide,
    OutlineSlide,
    Presentation,
    PresentationOutline,
    PresentationSlide,
    SlideGenerationRequest,
    SlideType,
    SummarySlide,
    TitleSlide,
    generate_uuid,
)


logger = logging.getLogger(__name__)


class GenerationError(Exception):
    """Raised when OpenAI generation fails or returns invalid output."""


class OutlineGenerationError(GenerationError):
    """Raised when OpenAI outline generation fails or returns invalid output."""


class PresentationGenerationError(GenerationError):
    """Raised when OpenAI presentation generation fails or returns invalid output."""


class SlideGenerationError(GenerationError):
    """Raised when OpenAI single-slide generation fails or returns invalid output."""


_client: OpenAI | None = None


def _get_openai_client() -> OpenAI:
    global _client

    if _client is None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise GenerationError(
                "OpenAI API key is not configured. Set OPENAI_API_KEY in backend/.env."
            )
        _client = OpenAI(api_key=settings.openai_api_key)

    return _client


def _raise_generation_error(
    error_type: type[GenerationError],
    public_message: str,
    *,
    category: str,
    cause: BaseException | None = None,
) -> NoReturn:
    """Raise a generation error after logging a categorized diagnostic traceback."""
    try:
        if cause is None:
            raise error_type(public_message)
        raise error_type(public_message) from cause
    except GenerationError:
        logger.exception("Generation failed: %s", category)
        raise


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
        _raise_generation_error(
            OutlineGenerationError,
            "OpenAI outline generation failed. Please try again.",
            category="OpenAI API request error during outline generation",
            cause=exc,
        )
    except GenerationError:
        logger.exception(
            "Generation failed: OpenAI API request setup error during outline generation"
        )
        raise
    except (ValidationError, TypeError, ValueError) as exc:
        _raise_generation_error(
            OutlineGenerationError,
            "OpenAI outline generation failed. Please try again.",
            category=(
                "Structured Outputs schema creation/parsing error "
                "during outline generation"
            ),
            cause=exc,
        )
    except Exception as exc:
        _raise_generation_error(
            OutlineGenerationError,
            "OpenAI outline generation failed unexpectedly. Please try again.",
            category=(
                "Structured Outputs schema creation/parsing error "
                "during outline generation"
            ),
            cause=exc,
        )

    parsed = response.output_parsed
    if parsed is None:
        _raise_generation_error(
            OutlineGenerationError,
            "OpenAI returned no structured outline. Please try again.",
            category="missing parsed output during outline generation",
        )

    if len(parsed.slides) != len(required_types):
        _raise_generation_error(
            OutlineGenerationError,
            "OpenAI returned an outline with the wrong number of slides. "
            f"Expected {len(required_types)}, got {len(parsed.slides)}.",
            category=(
                "slide count mismatch during outline generation "
                f"(expected {len(required_types)}, got {len(parsed.slides)})"
            ),
        )

    try:
        slides = [
            OutlineSlide(
                id=generate_uuid(),
                type=slide_type,
                title=ai_slide.title,
                content_summary=ai_slide.content_summary,
            )
            for slide_type, ai_slide in zip(
                required_types,
                parsed.slides,
                strict=True,
            )
        ]

        return PresentationOutline(
            title=parsed.title,
            learning_objective=parsed.learning_objective,
            slides=slides,
        )
    except Exception as exc:
        _raise_generation_error(
            OutlineGenerationError,
            "OpenAI outline generation failed while building the outline. "
            "Please try again.",
            category="conversion into PresentationOutline model",
            cause=exc,
        )


_PRESENTATION_SYSTEM_INSTRUCTIONS = """\
You are helping a middle-school teacher turn an approved lesson outline into \
complete classroom slides for students aged approximately 12–15. The slides must \
be ready to project.

General rules:
- Write in the same language as the outline.
- Follow each slide’s title and content_summary.
- Keep text concise and readable on a projected slide.
- Maintain factual accuracy and a coherent lesson flow.
- Do not use Markdown formatting inside strings.
- Do not include image URLs.
- Do not add or remove slides.

Per slide type:
- title: Generate a short engaging subtitle. Do not include lesson duration unless \
it is educationally relevant.
- content: body should be a short explanation, not a long paragraph. bullet_points \
should contain 2–4 focused supporting points when possible. Avoid unnecessary \
repetition between body and bullets.
- discussion: question should be student-facing and open enough for discussion. \
teacher_prompt should be a short private facilitation note for the teacher.
- multiple_choice: Write one clear question. Generate exactly four options. Include \
one unambiguously correct answer. Distractors should be plausible and preferably \
reflect misconceptions described in the outline. correct_option is zero-based. \
feedback should briefly explain why the answer is correct.
- summary: Generate 2–4 concise takeaways when possible. End with a short exit \
question requiring explanation or application.

Return exactly one generated content object for every outline slide, in the same \
order and with the same type. Do not generate slide IDs, slide titles, the \
presentation title, or the learning objective — the application owns those.
"""


def _build_presentation_input(outline: PresentationOutline) -> str:
    slide_sections = []
    for index, slide in enumerate(outline.slides, start=1):
        summary_lines = "\n".join(f"  - {item}" for item in slide.content_summary)
        slide_sections.append(
            f"{index}. type: {slide.type.value}\n"
            f"   title: {slide.title}\n"
            f"   content_summary:\n{summary_lines}"
        )

    slides_block = "\n".join(slide_sections)

    return (
        f"Presentation title:\n{outline.title}\n\n"
        f"Learning objective:\n{outline.learning_objective}\n\n"
        f"Approved outline ({len(outline.slides)} slides):\n"
        f"{slides_block}\n\n"
        "Generate the full slide content for each outline slide above, in the same "
        "order and with the same type."
    )


def generate_openai_presentation(outline: PresentationOutline) -> Presentation:
    settings = get_settings()

    try:
        response = _get_openai_client().responses.parse(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": _PRESENTATION_SYSTEM_INSTRUCTIONS,
                },
                {
                    "role": "user",
                    "content": _build_presentation_input(outline),
                },
            ],
            text_format=AIPresentationContent,
        )
    except APIError as exc:
        _raise_generation_error(
            PresentationGenerationError,
            "OpenAI presentation generation failed. Please try again.",
            category="OpenAI API request error during presentation generation",
            cause=exc,
        )
    except GenerationError:
        logger.exception(
            "Generation failed: OpenAI API request setup error "
            "during presentation generation"
        )
        raise
    except (ValidationError, TypeError, ValueError) as exc:
        _raise_generation_error(
            PresentationGenerationError,
            "OpenAI presentation generation failed. Please try again.",
            category=(
                "Structured Outputs schema creation/parsing error "
                "during presentation generation"
            ),
            cause=exc,
        )
    except Exception as exc:
        _raise_generation_error(
            PresentationGenerationError,
            "OpenAI presentation generation failed unexpectedly. Please try again.",
            category=(
                "Structured Outputs schema creation/parsing error "
                "during presentation generation"
            ),
            cause=exc,
        )

    parsed = response.output_parsed
    if parsed is None:
        _raise_generation_error(
            PresentationGenerationError,
            "OpenAI returned no structured presentation content. Please try again.",
            category="missing parsed output during presentation generation",
        )

    if len(parsed.slides) != len(outline.slides):
        _raise_generation_error(
            PresentationGenerationError,
            "OpenAI returned the wrong number of slides. "
            f"Expected {len(outline.slides)}, got {len(parsed.slides)}.",
            category=(
                "slide count mismatch during presentation generation "
                f"(expected {len(outline.slides)}, got {len(parsed.slides)})"
            ),
        )

    slides: list[PresentationSlide] = []

    for index, (outline_slide, ai_slide) in enumerate(
        zip(outline.slides, parsed.slides, strict=True)
    ):
        if ai_slide.type != outline_slide.type.value:
            _raise_generation_error(
                PresentationGenerationError,
                "OpenAI returned a slide of the wrong type. "
                f"Expected {outline_slide.type.value}, got {ai_slide.type}.",
                category=(
                    "slide type mismatch during presentation generation "
                    f"(index {index}: expected {outline_slide.type.value}, "
                    f"got {ai_slide.type})"
                ),
            )

        try:
            slide: PresentationSlide
            if ai_slide.type == "title":
                slide = TitleSlide(
                    id=outline_slide.id,
                    title=outline_slide.title,
                    subtitle=ai_slide.subtitle,
                    image_url=None,
                )
            elif ai_slide.type == "content":
                slide = ContentSlide(
                    id=outline_slide.id,
                    title=outline_slide.title,
                    body=ai_slide.body,
                    bullet_points=ai_slide.bullet_points,
                    image_url=None,
                )
            elif ai_slide.type == "discussion":
                slide = DiscussionSlide(
                    id=outline_slide.id,
                    title=outline_slide.title,
                    question=ai_slide.question,
                    teacher_prompt=ai_slide.teacher_prompt,
                )
            elif ai_slide.type == "multiple_choice":
                slide = MultipleChoiceSlide(
                    id=outline_slide.id,
                    title=outline_slide.title,
                    question=ai_slide.question,
                    options=ai_slide.options,
                    correct_option=ai_slide.correct_option,
                    feedback=ai_slide.feedback,
                )
            elif ai_slide.type == "summary":
                slide = SummarySlide(
                    id=outline_slide.id,
                    title=outline_slide.title,
                    key_points=ai_slide.key_points,
                    exit_question=ai_slide.exit_question,
                )
            else:
                _raise_generation_error(
                    PresentationGenerationError,
                    f"OpenAI returned an unsupported slide type: {ai_slide.type}",
                    category=(
                        "slide type mismatch during presentation generation "
                        f"(index {index}: unsupported type {ai_slide.type})"
                    ),
                )
        except PresentationGenerationError:
            raise
        except Exception as exc:
            _raise_generation_error(
                PresentationGenerationError,
                "OpenAI presentation generation failed while building a slide. "
                "Please try again.",
                category=(
                    "conversion into Presentation model "
                    f"(slide index {index}, type {outline_slide.type.value})"
                ),
                cause=exc,
            )

        slides.append(slide)

    try:
        return Presentation(
            title=outline.title,
            learning_objective=outline.learning_objective,
            slides=slides,
        )
    except Exception as exc:
        _raise_generation_error(
            PresentationGenerationError,
            "OpenAI presentation generation failed while assembling the "
            "presentation. Please try again.",
            category="conversion into Presentation model",
            cause=exc,
        )


_AI_SLIDE_SCHEMAS: dict[
    SlideType,
    type[
        AITitleSlideContent
        | AIContentSlideContent
        | AIDiscussionSlideContent
        | AIMultipleChoiceSlideContent
        | AISummarySlideContent
    ],
] = {
    SlideType.TITLE: AITitleSlideContent,
    SlideType.CONTENT: AIContentSlideContent,
    SlideType.DISCUSSION: AIDiscussionSlideContent,
    SlideType.MULTIPLE_CHOICE: AIMultipleChoiceSlideContent,
    SlideType.SUMMARY: AISummarySlideContent,
}


_SLIDE_SYSTEM_INSTRUCTIONS = """\
You are helping a middle-school teacher add one new slide to an existing classroom \
presentation for students aged approximately 12–15. The slide must be ready to \
project.

General rules:
- Write in the same language as the supplied presentation context.
- Generate only the requested slide.
- Follow the teacher’s content description.
- Fit coherently between the neighboring slides.
- Avoid repeating the previous slide.
- Do not introduce material that belongs only to the next slide.
- Keep text concise and readable on a projected slide.
- Maintain factual accuracy.
- Do not use Markdown formatting inside strings.
- Do not generate IDs, titles, image URLs, or additional slides.

Per slide type:
- title: Generate a short engaging subtitle. Do not include lesson duration unless \
it is educationally relevant.
- content: body should be a short explanation, not a long paragraph. bullet_points \
should contain 2–4 focused supporting points when possible. Avoid unnecessary \
repetition between body and bullets.
- discussion: question should be student-facing and open enough for discussion. \
teacher_prompt should be a short private facilitation note for the teacher.
- multiple_choice: Write one clear question. Generate exactly four options. Include \
one unambiguously correct answer. Distractors should be plausible and preferably \
reflect misconceptions implied by the content description. correct_option is \
zero-based. feedback should briefly explain why the answer is correct.
- summary: Generate 2–4 concise takeaways when possible. End with a short exit \
question requiring explanation or application.
"""


def _build_slide_input(request: SlideGenerationRequest) -> str:
    lines = [
        f"Presentation title:\n{request.presentation_title}",
        f"Learning objective:\n{request.learning_objective}",
        f"Requested slide type: {request.slide_type.value}",
        f"Slide title (fixed, do not change): {request.title}",
        f"Teacher’s content description:\n{request.content_description}",
    ]

    if request.previous_slide_title:
        lines.append(f"Previous slide title: {request.previous_slide_title}")
    if request.next_slide_title:
        lines.append(f"Next slide title: {request.next_slide_title}")

    lines.append(
        "Generate the content for this one slide only, matching the requested type."
    )

    return "\n\n".join(lines)


def generate_openai_slide(request: SlideGenerationRequest) -> PresentationSlide:
    settings = get_settings()
    ai_schema = _AI_SLIDE_SCHEMAS[request.slide_type]

    try:
        response = _get_openai_client().responses.parse(
            model=settings.openai_model,
            input=[
                {
                    "role": "system",
                    "content": _SLIDE_SYSTEM_INSTRUCTIONS,
                },
                {
                    "role": "user",
                    "content": _build_slide_input(request),
                },
            ],
            text_format=ai_schema,
        )
    except APIError as exc:
        _raise_generation_error(
            SlideGenerationError,
            "OpenAI slide generation failed. Please try again.",
            category="OpenAI API request error during slide generation",
            cause=exc,
        )
    except GenerationError:
        logger.exception(
            "Generation failed: OpenAI API request setup error during slide generation"
        )
        raise
    except (ValidationError, TypeError, ValueError) as exc:
        _raise_generation_error(
            SlideGenerationError,
            "OpenAI slide generation failed. Please try again.",
            category=(
                "Structured Outputs schema creation/parsing error "
                "during slide generation"
            ),
            cause=exc,
        )
    except Exception as exc:
        _raise_generation_error(
            SlideGenerationError,
            "OpenAI slide generation failed unexpectedly. Please try again.",
            category=(
                "Structured Outputs schema creation/parsing error "
                "during slide generation"
            ),
            cause=exc,
        )

    parsed = response.output_parsed
    if parsed is None:
        _raise_generation_error(
            SlideGenerationError,
            "OpenAI returned no structured slide content. Please try again.",
            category="missing parsed output during slide generation",
        )

    if parsed.type != request.slide_type.value:
        _raise_generation_error(
            SlideGenerationError,
            "OpenAI returned a slide of the wrong type. "
            f"Expected {request.slide_type.value}, got {parsed.type}.",
            category=(
                "slide type mismatch during slide generation "
                f"(expected {request.slide_type.value}, got {parsed.type})"
            ),
        )

    slide_id = generate_uuid()
    slide_title = request.title.strip()

    try:
        if isinstance(parsed, AITitleSlideContent):
            return TitleSlide(
                id=slide_id,
                title=slide_title,
                subtitle=parsed.subtitle,
                image_url=None,
            )
        if isinstance(parsed, AIContentSlideContent):
            return ContentSlide(
                id=slide_id,
                title=slide_title,
                body=parsed.body,
                bullet_points=parsed.bullet_points,
                image_url=None,
            )
        if isinstance(parsed, AIDiscussionSlideContent):
            return DiscussionSlide(
                id=slide_id,
                title=slide_title,
                question=parsed.question,
                teacher_prompt=parsed.teacher_prompt,
            )
        if isinstance(parsed, AIMultipleChoiceSlideContent):
            return MultipleChoiceSlide(
                id=slide_id,
                title=slide_title,
                question=parsed.question,
                options=parsed.options,
                correct_option=parsed.correct_option,
                feedback=parsed.feedback,
            )
        if isinstance(parsed, AISummarySlideContent):
            return SummarySlide(
                id=slide_id,
                title=slide_title,
                key_points=parsed.key_points,
                exit_question=parsed.exit_question,
            )
    except Exception as exc:
        _raise_generation_error(
            SlideGenerationError,
            "OpenAI slide generation failed while building the slide. "
            "Please try again.",
            category=(
                "conversion into PresentationSlide model "
                f"(type {request.slide_type.value})"
            ),
            cause=exc,
        )

    _raise_generation_error(
        SlideGenerationError,
        f"OpenAI returned an unsupported slide type: {parsed.type}",
        category=(
            "slide type mismatch during slide generation "
            f"(unsupported type {parsed.type})"
        ),
    )
