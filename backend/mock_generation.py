from uuid import NAMESPACE_URL, uuid4, uuid5

from backend.answer_positioning import (
    position_for_multiple_choice_ordinal,
    reposition_correct_option,
    stable_correct_position,
)
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
)


def _stable_id(*parts: object) -> str:
    value = "|".join(str(part) for part in parts)
    return str(uuid5(NAMESPACE_URL, value))


def generate_mock_outline(brief: LessonBrief) -> PresentationOutline:
    title = f"Lesson: {brief.prompt}"
    learning_objective = (
        f"By the end of this {brief.duration_minutes}-minute lesson, learners will "
        f"be able to explain the main ideas in: {brief.prompt}"
    )

    slides: list[OutlineSlide] = []
    content_pair_number = 0

    for index, slide_type in enumerate(
        slide_types_for_duration(brief.duration_minutes)
    ):
        if slide_type == SlideType.TITLE:
            slide_title = title
            content_summary = [f"Introduce the lesson topic: {brief.prompt}"]
        elif slide_type == SlideType.DISCUSSION:
            slide_title = "Opening Discussion"
            content_summary = [
                f"Invite learners to share what they already know about {brief.prompt}"
            ]
        elif slide_type == SlideType.CONTENT:
            content_pair_number += 1
            slide_title = f"Key Idea {content_pair_number}"
            content_summary = [
                f"Explain key idea {content_pair_number} about {brief.prompt}",
                "Give a clear example",
            ]
        elif slide_type == SlideType.MULTIPLE_CHOICE:
            slide_title = f"Check for Understanding {content_pair_number}"
            content_summary = [
                f"Check understanding of key idea {content_pair_number} about "
                f"{brief.prompt}"
            ]
        elif slide_type == SlideType.SUMMARY:
            slide_title = "Lesson Summary"
            content_summary = [
                f"Review the main ideas from {brief.prompt}",
                "Prompt a final reflection",
            ]
        else:
            raise ValueError(f"Unsupported slide type: {slide_type}")

        slides.append(
            OutlineSlide(
                id=_stable_id(
                    brief.prompt,
                    brief.duration_minutes,
                    index,
                    slide_type,
                ),
                type=slide_type,
                title=slide_title,
                content_summary=content_summary,
            )
        )

    return PresentationOutline(
        title=title,
        learning_objective=learning_objective,
        slides=slides,
    )


def generate_mock_presentation(outline: PresentationOutline) -> Presentation:
    slides: list[PresentationSlide] = []
    multiple_choice_ordinal = 0

    for outline_slide in outline.slides:
        summaries = outline_slide.content_summary

        if outline_slide.type == SlideType.TITLE:
            slide = TitleSlide(
                id=outline_slide.id,
                title=outline_slide.title,
                subtitle=outline.learning_objective,
            )
        elif outline_slide.type == SlideType.CONTENT:
            slide = ContentSlide(
                id=outline_slide.id,
                title=outline_slide.title,
                body=" ".join(summaries),
                bullet_points=summaries,
            )
        elif outline_slide.type == SlideType.DISCUSSION:
            slide = DiscussionSlide(
                id=outline_slide.id,
                title=outline_slide.title,
                question=summaries[0],
                teacher_prompt=f"Guide the discussion toward: {outline.learning_objective}",
            )
        elif outline_slide.type == SlideType.MULTIPLE_CHOICE:
            options, correct_option = reposition_correct_option(
                [
                    "The first key idea",
                    "A related but incomplete idea",
                    "An unrelated idea",
                    "A common misconception",
                ],
                0,
                position_for_multiple_choice_ordinal(multiple_choice_ordinal, 4),
            )
            multiple_choice_ordinal += 1
            slide = MultipleChoiceSlide(
                id=outline_slide.id,
                title=outline_slide.title,
                question=summaries[0],
                options=options,
                correct_option=correct_option,
                feedback=f"Review the lesson objective: {outline.learning_objective}",
            )
        elif outline_slide.type == SlideType.SUMMARY:
            slide = SummarySlide(
                id=outline_slide.id,
                title=outline_slide.title,
                key_points=summaries,
                exit_question=f"How would you explain the main idea of {outline.title}?",
            )
        else:
            raise ValueError(f"Unsupported slide type: {outline_slide.type}")

        slides.append(slide)

    return Presentation(
        title=outline.title,
        learning_objective=outline.learning_objective,
        slides=slides,
    )


def generate_mock_slide(request: SlideGenerationRequest) -> PresentationSlide:
    slide_id = str(uuid4())

    if request.slide_type == SlideType.TITLE:
        return TitleSlide(
            id=slide_id,
            title=request.title,
            subtitle=request.content_description,
        )

    if request.slide_type == SlideType.CONTENT:
        return ContentSlide(
            id=slide_id,
            title=request.title,
            body=request.content_description,
            bullet_points=[request.content_description],
        )

    if request.slide_type == SlideType.DISCUSSION:
        return DiscussionSlide(
            id=slide_id,
            title=request.title,
            question=request.content_description,
            teacher_prompt=f"Connect responses to: {request.learning_objective}",
        )

    if request.slide_type == SlideType.MULTIPLE_CHOICE:
        options, correct_option = reposition_correct_option(
            [
                "The best answer",
                "A plausible alternative",
                "An unrelated answer",
                "A common misconception",
            ],
            0,
            stable_correct_position(slide_id, 4),
        )
        return MultipleChoiceSlide(
            id=slide_id,
            title=request.title,
            question=request.content_description,
            options=options,
            correct_option=correct_option,
            feedback=f"Use the objective to review your answer: {request.learning_objective}",
        )

    if request.slide_type == SlideType.SUMMARY:
        return SummarySlide(
            id=slide_id,
            title=request.title,
            key_points=[request.content_description],
            exit_question=f"What is your main takeaway from {request.presentation_title}?",
        )

    raise ValueError(f"Unsupported slide type: {request.slide_type}")
