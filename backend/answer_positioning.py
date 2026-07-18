"""Backend-controlled positioning of the correct multiple-choice option."""

import hashlib

# Zero-based display positions for consecutive multiple-choice slides:
# first question -> B, second -> D, third -> A, fourth -> C, then repeat.
CORRECT_POSITION_CYCLE = (1, 3, 0, 2)


def reposition_correct_option(
    options: list[str],
    correct_option: int,
    desired_position: int,
) -> tuple[list[str], int]:
    """Move the correct option to the desired position.

    Preserves every option and the relative order of the distractors, and
    returns the reordered options with the updated zero-based correct index.
    Works with duplicate option strings because it moves entries by index.
    """
    if not 0 <= correct_option < len(options):
        raise ValueError("correct_option must point to an existing option")

    position = max(0, min(desired_position, len(options) - 1))

    reordered = list(options)
    correct_text = reordered.pop(correct_option)
    reordered.insert(position, correct_text)

    return reordered, position


def position_for_multiple_choice_ordinal(
    ordinal: int,
    option_count: int,
) -> int:
    """Desired correct position for the ordinal-th multiple-choice slide (0-based)."""
    desired = CORRECT_POSITION_CYCLE[ordinal % len(CORRECT_POSITION_CYCLE)]
    return min(desired, option_count - 1)


def stable_correct_position(key: str, option_count: int) -> int:
    """Deterministic position derived from a stable SHA-256 hash of the key."""
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % option_count
