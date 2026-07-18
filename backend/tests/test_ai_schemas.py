"""Tests protecting OpenAI Structured Outputs schema constraints."""

import unittest
from typing import Any

from backend.ai_schemas import (
    AIContentSlideContent,
    AIDiscussionSlideContent,
    AIMultipleChoiceSlideContent,
    AIPresentationContent,
    AISummarySlideContent,
    AITitleSlideContent,
)


SINGLE_SLIDE_SCHEMAS = (
    AITitleSlideContent,
    AIContentSlideContent,
    AIDiscussionSlideContent,
    AIMultipleChoiceSlideContent,
    AISummarySlideContent,
)


def _schema_contains_key(node: Any, key: str) -> bool:
    if isinstance(node, dict):
        if key in node:
            return True
        return any(_schema_contains_key(value, key) for value in node.values())
    if isinstance(node, list):
        return any(_schema_contains_key(item, key) for item in node)
    return False


class AIPresentationSchemaTests(unittest.TestCase):
    def test_presentation_schema_uses_anyof_not_oneof(self) -> None:
        schema = AIPresentationContent.model_json_schema()

        self.assertEqual(schema.get("type"), "object")
        self.assertFalse(
            _schema_contains_key(schema, "oneOf"),
            "AIPresentationContent schema must not contain oneOf",
        )

        slides = schema["properties"]["slides"]
        items = slides["items"]
        # Resolve $ref if a future Pydantic version nests the union under $defs.
        if "$ref" in items:
            ref_name = items["$ref"].rsplit("/", 1)[-1]
            items = schema["$defs"][ref_name]

        self.assertIn(
            "anyOf",
            items,
            "slide alternatives must use nested anyOf",
        )
        self.assertNotIn("oneOf", items)


class AISingleSlideSchemaTests(unittest.TestCase):
    def test_concrete_slide_schemas_are_plain_objects(self) -> None:
        for schema_cls in SINGLE_SLIDE_SCHEMAS:
            with self.subTest(schema=schema_cls.__name__):
                schema = schema_cls.model_json_schema()
                self.assertEqual(schema.get("type"), "object")
                self.assertNotIn("oneOf", schema)
                self.assertNotIn("anyOf", schema)


if __name__ == "__main__":
    unittest.main()
