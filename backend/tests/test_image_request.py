"""Tests for image-generation request slide-type validation."""

import unittest

from pydantic import ValidationError

from backend.models import (
    ContentSlide,
    DiscussionSlide,
    MultipleChoiceSlide,
    SlideImageGenerationRequest,
    SummarySlide,
    TitleSlide,
)


class SlideImageGenerationRequestTests(unittest.TestCase):
    def _request_kwargs(self) -> dict:
        return {
            "presentation_title": "Volcanoes",
            "learning_objective": "Explain how volcanoes form and erupt.",
        }

    def test_accepts_title_slide(self) -> None:
        request = SlideImageGenerationRequest(
            **self._request_kwargs(),
            slide=TitleSlide(title="Volcanoes", subtitle="Earth's fire"),
        )
        self.assertEqual(request.slide.type, "title")

    def test_accepts_content_slide(self) -> None:
        request = SlideImageGenerationRequest(
            **self._request_kwargs(),
            slide=ContentSlide(
                title="Magma",
                body="Magma rises through the crust.",
                bullet_points=["Heat", "Pressure"],
            ),
        )
        self.assertEqual(request.slide.type, "content")

    def test_rejects_discussion_slide(self) -> None:
        with self.assertRaises(ValidationError):
            SlideImageGenerationRequest(
                **self._request_kwargs(),
                slide=DiscussionSlide(
                    title="Opening",
                    question="What do you know about volcanoes?",
                    teacher_prompt="Invite a few responses.",
                ),
            )

    def test_rejects_multiple_choice_slide(self) -> None:
        with self.assertRaises(ValidationError):
            SlideImageGenerationRequest(
                **self._request_kwargs(),
                slide=MultipleChoiceSlide(
                    title="Check",
                    question="What is magma?",
                    options=["Melted rock", "Water", "Air", "Sand"],
                    correct_option=0,
                    feedback="Magma is melted rock.",
                ),
            )

    def test_rejects_summary_slide(self) -> None:
        with self.assertRaises(ValidationError):
            SlideImageGenerationRequest(
                **self._request_kwargs(),
                slide=SummarySlide(
                    title="Summary",
                    key_points=["Heat", "Pressure", "Eruption"],
                    exit_question="How would you explain a volcano?",
                ),
            )


if __name__ == "__main__":
    unittest.main()
