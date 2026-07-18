from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


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
