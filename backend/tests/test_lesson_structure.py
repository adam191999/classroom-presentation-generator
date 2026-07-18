"""Tests for deterministic lesson slide structure by duration."""

import unittest

from backend.lesson_structure import slide_types_for_duration
from backend.models import SlideType


class LessonStructureTests(unittest.TestCase):
    def test_10_minute_structure(self) -> None:
        self.assertEqual(
            slide_types_for_duration(10),
            [
                SlideType.TITLE,
                SlideType.DISCUSSION,
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
                SlideType.SUMMARY,
            ],
        )

    def test_15_minute_structure(self) -> None:
        self.assertEqual(
            slide_types_for_duration(15),
            [
                SlideType.TITLE,
                SlideType.DISCUSSION,
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
                SlideType.SUMMARY,
            ],
        )

    def test_20_minute_structure(self) -> None:
        self.assertEqual(
            slide_types_for_duration(20),
            [
                SlideType.TITLE,
                SlideType.DISCUSSION,
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
                SlideType.SUMMARY,
            ],
        )


if __name__ == "__main__":
    unittest.main()
