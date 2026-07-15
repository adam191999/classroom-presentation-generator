from enum import Enum
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


NonEmptyString = Annotated[str, Field(min_length=1)]


class ProjectModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


def generate_uuid() -> str:
    return str(uuid4())


class LessonBrief(ProjectModel):
    prompt: str = Field(min_length=10, max_length=2000)
    duration_minutes: Literal[10, 15, 20]


class SlideType(str, Enum):
    TITLE = "title"
    CONTENT = "content"
    DISCUSSION = "discussion"
    MULTIPLE_CHOICE = "multiple_choice"
    SUMMARY = "summary"


class OutlineSlide(ProjectModel):
    id: str = Field(default_factory=generate_uuid)
    type: SlideType
    title: NonEmptyString
    content_summary: list[NonEmptyString] = Field(min_length=1, max_length=5)


class PresentationOutline(ProjectModel):
    title: NonEmptyString
    learning_objective: NonEmptyString
    slides: list[OutlineSlide] = Field(min_length=1, max_length=20)


class TitleSlide(ProjectModel):
    id: str = Field(default_factory=generate_uuid)
    type: Literal["title"] = "title"
    title: NonEmptyString
    subtitle: NonEmptyString | None = None
    image_url: NonEmptyString | None = None


class ContentSlide(ProjectModel):
    id: str = Field(default_factory=generate_uuid)
    type: Literal["content"] = "content"
    title: NonEmptyString
    body: NonEmptyString
    bullet_points: list[NonEmptyString] = Field(min_length=1, max_length=5)
    image_url: NonEmptyString | None = None


class DiscussionSlide(ProjectModel):
    id: str = Field(default_factory=generate_uuid)
    type: Literal["discussion"] = "discussion"
    title: NonEmptyString
    question: NonEmptyString
    teacher_prompt: NonEmptyString


class MultipleChoiceSlide(ProjectModel):
    id: str = Field(default_factory=generate_uuid)
    type: Literal["multiple_choice"] = "multiple_choice"
    title: NonEmptyString
    question: NonEmptyString
    options: list[NonEmptyString] = Field(min_length=2, max_length=6)
    correct_option: int = Field(
        ge=0,
        description="Zero-based index of the correct option.",
    )
    feedback: NonEmptyString

    @model_validator(mode="after")
    def validate_correct_option(self) -> "MultipleChoiceSlide":
        if self.correct_option >= len(self.options):
            raise ValueError("correct_option must point to an existing option")
        return self


class SummarySlide(ProjectModel):
    id: str = Field(default_factory=generate_uuid)
    type: Literal["summary"] = "summary"
    title: NonEmptyString
    key_points: list[NonEmptyString] = Field(min_length=1, max_length=5)
    exit_question: NonEmptyString


PresentationSlide = Annotated[
    TitleSlide
    | ContentSlide
    | DiscussionSlide
    | MultipleChoiceSlide
    | SummarySlide,
    Field(discriminator="type"),
]


class Presentation(ProjectModel):
    title: NonEmptyString
    learning_objective: NonEmptyString
    slides: list[PresentationSlide] = Field(min_length=1, max_length=20)


class SlideGenerationRequest(ProjectModel):
    presentation_title: NonEmptyString
    learning_objective: NonEmptyString
    slide_type: SlideType
    title: NonEmptyString
    content_description: str = Field(min_length=10, max_length=500)
    previous_slide_title: NonEmptyString | None = None
    next_slide_title: NonEmptyString | None = None
