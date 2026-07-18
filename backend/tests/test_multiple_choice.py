"""Tests for multiple-choice model validation and option reordering."""

import unittest
from collections import Counter

from pydantic import ValidationError

from backend.answer_positioning import reposition_correct_option
from backend.models import MultipleChoiceSlide


class MultipleChoiceModelValidationTests(unittest.TestCase):
    def _base_kwargs(self) -> dict:
        return {
            "title": "Check",
            "question": "Which option is correct?",
            "options": ["A", "B", "C", "D"],
            "feedback": "Because A is right.",
        }

    def test_valid_zero_based_correct_option_is_accepted(self) -> None:
        slide = MultipleChoiceSlide(
            **self._base_kwargs(),
            correct_option=0,
        )
        self.assertEqual(slide.correct_option, 0)

        slide = MultipleChoiceSlide(
            **self._base_kwargs(),
            correct_option=3,
        )
        self.assertEqual(slide.correct_option, 3)

    def test_negative_correct_option_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            MultipleChoiceSlide(
                **self._base_kwargs(),
                correct_option=-1,
            )

    def test_correct_option_equal_to_len_options_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            MultipleChoiceSlide(
                **self._base_kwargs(),
                correct_option=4,
            )


class OptionReorderingHelperTests(unittest.TestCase):
    def test_move_correct_option_0_to_position_3(self) -> None:
        options = ["right", "d1", "d2", "d3"]
        reordered, correct = reposition_correct_option(options, 0, 3)

        self.assertEqual(correct, 3)
        self.assertEqual(reordered[correct], "right")
        self.assertEqual(Counter(reordered), Counter(options))
        self.assertEqual(len(reordered), len(options))
        self.assertEqual(reordered, ["d1", "d2", "d3", "right"])
        self.assertEqual(
            [item for item in reordered if item != "right"],
            ["d1", "d2", "d3"],
        )

    def test_duplicate_option_strings_move_by_index(self) -> None:
        # Index 1 is the intended correct entry even though text matches index 0.
        options = ["same", "same", "x", "y"]
        reordered, correct = reposition_correct_option(options, 1, 0)

        self.assertEqual(correct, 0)
        self.assertEqual(reordered, ["same", "same", "x", "y"])
        self.assertEqual(reordered[correct], "same")

        # Moving the first "same" (index 0) to the end must leave the other
        # "same" in place and put the moved original first item last.
        reordered2, correct2 = reposition_correct_option(options, 0, 3)
        self.assertEqual(correct2, 3)
        self.assertEqual(reordered2, ["same", "x", "y", "same"])
        self.assertEqual(reordered2[correct2], "same")


if __name__ == "__main__":
    unittest.main()
