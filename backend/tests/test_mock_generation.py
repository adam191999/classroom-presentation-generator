"""Tests for mock outline and full-presentation generation."""

import unittest

from backend.lesson_structure import slide_types_for_duration
from backend.mock_generation import generate_mock_outline, generate_mock_presentation
from backend.models import LessonBrief, Presentation, SlideType


SUPPORTED_DURATIONS = (10, 15, 20)


class MockOutlineGenerationTests(unittest.TestCase):
    def test_outline_for_every_supported_duration(self) -> None:
        for duration in SUPPORTED_DURATIONS:
            with self.subTest(duration=duration):
                outline = generate_mock_outline(
                    LessonBrief(
                        prompt="How do volcanoes form and erupt?",
                        duration_minutes=duration,
                    )
                )
                expected_types = slide_types_for_duration(duration)

                self.assertEqual(len(outline.slides), len(expected_types))
                self.assertEqual(
                    [slide.type for slide in outline.slides],
                    expected_types,
                )

                ids = [slide.id for slide in outline.slides]
                self.assertTrue(all(slide_id.strip() for slide_id in ids))
                self.assertEqual(len(ids), len(set(ids)))


class MockPresentationGenerationTests(unittest.TestCase):
    def test_preserves_outline_ids_order_and_types(self) -> None:
        outline = generate_mock_outline(
            LessonBrief(
                prompt="How do volcanoes form and erupt?",
                duration_minutes=15,
            )
        )
        presentation = generate_mock_presentation(outline)

        Presentation.model_validate(presentation.model_dump())

        self.assertEqual(
            [slide.id for slide in presentation.slides],
            [slide.id for slide in outline.slides],
        )
        self.assertEqual(
            [slide.type for slide in presentation.slides],
            [slide.type.value for slide in outline.slides],
        )

    def test_20_minute_multiple_choice_positions_are_b_d_a(self) -> None:
        outline = generate_mock_outline(
            LessonBrief(
                prompt="How do volcanoes form and erupt?",
                duration_minutes=20,
            )
        )
        presentation = generate_mock_presentation(outline)
        Presentation.model_validate(presentation.model_dump())

        multiple_choice = [
            slide
            for slide in presentation.slides
            if slide.type == SlideType.MULTIPLE_CHOICE.value
        ]
        self.assertEqual(len(multiple_choice), 3)
        self.assertEqual(
            [slide.correct_option for slide in multiple_choice],
            [1, 3, 0],
        )


if __name__ == "__main__":
    unittest.main()
