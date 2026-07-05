import sys
sys.path.insert(0, '/Users/dong/Documents/code/fit/backend')

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.diet import FoodDatabase, FoodDbStatus

foods = [
    {"food_name": "米饭", "category": "主食", "calorie_per_100g": 116, "protein_per_100g": 2.6, "carb_per_100g": 25.9, "fat_per_100g": 0.3},
    {"food_name": "鸡胸肉", "category": "肉类", "calorie_per_100g": 165, "protein_per_100g": 31, "carb_per_100g": 0, "fat_per_100g": 3.6},
    {"food_name": "西兰花", "category": "蔬菜", "calorie_per_100g": 34, "protein_per_100g": 2.8, "carb_per_100g": 7, "fat_per_100g": 0.4},
    {"food_name": "鸡蛋", "category": "蛋类", "calorie_per_100g": 155, "protein_per_100g": 13, "carb_per_100g": 1.1, "fat_per_100g": 11},
    {"food_name": "香蕉", "category": "水果", "calorie_per_100g": 93, "protein_per_100g": 1.1, "carb_per_100g": 22.8, "fat_per_100g": 0.3},
    {"food_name": "燕麦", "category": "主食", "calorie_per_100g": 389, "protein_per_100g": 16.9, "carb_per_100g": 66.3, "fat_per_100g": 6.9},
    {"food_name": "牛肉", "category": "肉类", "calorie_per_100g": 250, "protein_per_100g": 26, "carb_per_100g": 0, "fat_per_100g": 15},
    {"food_name": "三文鱼", "category": "肉类", "calorie_per_100g": 208, "protein_per_100g": 20, "carb_per_100g": 0, "fat_per_100g": 13},
    {"food_name": "牛奶", "category": "饮品", "calorie_per_100g": 54, "protein_per_100g": 3, "carb_per_100g": 4.7, "fat_per_100g": 3.2},
    {"food_name": "苹果", "category": "水果", "calorie_per_100g": 52, "protein_per_100g": 0.3, "carb_per_100g": 13.8, "fat_per_100g": 0.2},
]


def seed():
    db: Session = SessionLocal()
    try:
        existing = {f.food_name for f in db.query(FoodDatabase).all()}
        for food in foods:
            if food["food_name"] not in existing:
                db.add(FoodDatabase(**food, alias_names="", source="manual", status=FoodDbStatus.active))
        db.commit()
        print(f"Seeded {len(foods)} foods")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
