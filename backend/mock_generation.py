from uuid import NAMESPACE_URL, uuid5

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
    slide_specs = [
        (
            SlideType.TITLE,
            title,
            [f"Introduce the lesson topic: {brief.prompt}"],
        ),
        (
            SlideType.DISCUSSION,
            "Opening Discussion",
            [f"Invite learners to share what they already know about {brief.prompt}"],
        ),
        (
            SlideType.CONTENT,
            "Key Idea",
            [f"Explain the central idea behind {brief.prompt}", "Give a clear example"],
        ),
        (
            SlideType.CONTENT,
            "Explore the Topic",
            [f"Develop understanding of {brief.prompt}", "Connect the idea to practice"],
        ),
        (
            SlideType.MULTIPLE_CHOICE,
            "Check for Understanding",
            [f"Check learners' understanding of {brief.prompt}"],
        ),
        (
            SlideType.SUMMARY,
            "Lesson Summary",
            [f"Review the main ideas from {brief.prompt}", "Prompt a final reflection"],
        ),
    ]

    slides = [
        OutlineSlide(
            id=_stable_id(brief.prompt, brief.duration_minutes, index, slide_type),
            type=slide_type,
            title=slide_title,
            content_summary=content_summary,
        )
        for index, (slide_type, slide_title, content_summary) in enumerate(slide_specs)
    ]

    return PresentationOutline(
        title=title,
        learning_objective=learning_objective,
        slides=slides,
    )


def generate_mock_presentation(outline: PresentationOutline) -> Presentation:
    slides: list[PresentationSlide] = []

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
            slide = MultipleChoiceSlide(
                id=outline_slide.id,
                title=outline_slide.title,
                question=summaries[0],
                options=[
                    "The first key idea",
                    "A related but incomplete idea",
                    "An unrelated idea",
                    "None of the above",
                ],
                correct_option=0,
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
    slide_id = _stable_id(
        request.presentation_title,
        request.learning_objective,
        request.slide_type,
        request.title,
        request.content_description,
        request.previous_slide_title,
        request.next_slide_title,
    )

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
        return MultipleChoiceSlide(
            id=slide_id,
            title=request.title,
            question=request.content_description,
            options=[
                "The best answer",
                "A plausible alternative",
                "An unrelated answer",
                "Not enough information",
            ],
            correct_option=0,
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
