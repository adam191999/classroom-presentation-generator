from typing import Literal

from backend.models import SlideType


DurationMinutes = Literal[10, 15, 20]


def slide_types_for_duration(duration_minutes: DurationMinutes) -> list[SlideType]:
    """Return the deterministic ordered slide types for a lesson duration."""
    pair_count = {10: 1, 15: 2, 20: 3}[duration_minutes]

    slide_types: list[SlideType] = [
        SlideType.TITLE,
        SlideType.DISCUSSION,
    ]

    for _ in range(pair_count):
        slide_types.extend(
            [
                SlideType.CONTENT,
                SlideType.MULTIPLE_CHOICE,
            ]
        )

    slide_types.append(SlideType.SUMMARY)
    return slide_types
