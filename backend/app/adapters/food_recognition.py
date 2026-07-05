import uuid
from typing import Any


class FoodRecognitionAdapter:
    """MVP mock adapter; swap implementation for real third-party API."""

    def recognize(self, image_path: str, meal_type: str, record_time: str) -> dict[str, Any]:
        return {
            "recognize_id": f"rec_{uuid.uuid4().hex[:16]}",
            "status": "success",
            "candidates": [
                {
                    "food_name": "米饭",
                    "portion_desc": "1碗",
                    "weight_g": 180,
                    "calorie": 210,
                    "protein": 4,
                    "carb": 46,
                    "fat": 0.5,
                    "confidence": 0.9,
                },
                {
                    "food_name": "鸡胸肉",
                    "portion_desc": "1块",
                    "weight_g": 150,
                    "calorie": 165,
                    "protein": 31,
                    "carb": 0,
                    "fat": 3.6,
                    "confidence": 0.88,
                },
            ],
        }
