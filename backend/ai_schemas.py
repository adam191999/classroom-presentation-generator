from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


NonEmptyString = Annotated[str, Field(min_length=1)]


class AIOutlineSlide(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: NonEmptyString
    content_summary: list[NonEmptyString] = Field(min_length=1, max_length=5)


class AIOutline(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: NonEmptyString
    learning_objective: NonEmptyString
    slides: list[AIOutlineSlide]


class AITitleSlideContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    type: Literal["title"]
    subtitle: NonEmptyString | None = None


class AIContentSlideContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    type: Literal["content"]
    body: NonEmptyString
    bullet_points: list[NonEmptyString] = Field(min_length=1, max_length=5)


class AIDiscussionSlideContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    type: Literal["discussion"]
    question: NonEmptyString
    teacher_prompt: NonEmptyString


class AIMultipleChoiceSlideContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    type: Literal["multiple_choice"]
    question: NonEmptyString
    options: list[NonEmptyString] = Field(min_length=4, max_length=4)
    correct_option: int = Field(
        ge=0,
        description="Zero-based index of the correct option.",
    )
    feedback: NonEmptyString

    @model_validator(mode="after")
    def validate_correct_option(self) -> "AIMultipleChoiceSlideContent":
        if self.correct_option >= len(self.options):
            raise ValueError("correct_option must point to an existing option")
        return self


class AISummarySlideContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    type: Literal["summary"]
    key_points: list[NonEmptyString] = Field(min_length=1, max_length=5)
    exit_question: NonEmptyString


AISlideContent = (
    AITitleSlideContent
    | AIContentSlideContent
    | AIDiscussionSlideContent
    | AIMultipleChoiceSlideContent
    | AISummarySlideContent
)


class AIPresentationContent(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    slides: list[AISlideContent]
