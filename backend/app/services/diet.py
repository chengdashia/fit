from datetime import date, datetime
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.exceptions import AppException
from app.models.diet import (
    MealRecord,
    MealFoodItem,
    FrequentFood,
    FoodDatabase,
    MealType,
    SourceType,
    MealRecordStatus,
    DataSource,
    FrequentSourceType,
    FrequentStatus,
    FoodDbStatus,
)


def _to_meal_type(value: str) -> MealType:
    try:
        return MealType(value)
    except ValueError:
        raise AppException(40003, "无效的用餐类型")


def _to_source_type(value: str) -> SourceType:
    try:
        return SourceType(value)
    except ValueError:
        raise AppException(40003, "无效的来源类型")


def _to_data_source(value: str) -> DataSource:
    try:
        return DataSource(value)
    except ValueError:
        raise AppException(40003, "无效的数据来源")


def _to_frequent_source_type(source_type: str) -> FrequentSourceType:
    try:
        return FrequentSourceType(source_type)
    except ValueError:
        mapping = {
            SourceType.photo_ai.value: FrequentSourceType.ai_saved,
            SourceType.manual_search.value: FrequentSourceType.manual,
        }
        return mapping.get(source_type, FrequentSourceType.custom)


def search_foods(db: Session, user_id: str, keyword: str):
    like_keyword = f"%{keyword}%"
    db_foods = (
        db.query(FoodDatabase)
        .filter(
            FoodDatabase.status == FoodDbStatus.active,
        )
        .filter(
            (FoodDatabase.food_name.ilike(like_keyword))
            | (FoodDatabase.alias_names.ilike(like_keyword))
        )
        .all()
    )
    frequent_foods = (
        db.query(FrequentFood)
        .filter(
            FrequentFood.user_id == user_id,
            FrequentFood.food_name.ilike(like_keyword),
            FrequentFood.status == FrequentStatus.active,
        )
        .all()
    )

    results = []
    for food in db_foods:
        results.append({
            "id": food.id,
            "food_name": food.food_name,
            "category": food.category,
            "calorie_per_100g": food.calorie_per_100g,
            "protein_per_100g": food.protein_per_100g,
            "carb_per_100g": food.carb_per_100g,
            "fat_per_100g": food.fat_per_100g,
            "source": "standard_db",
        })
    for food in frequent_foods:
        weight = food.default_weight_g or 0
        if weight > 0:
            factor = 100.0 / weight
        else:
            factor = 0
        results.append({
            "id": food.id,
            "food_name": food.food_name,
            "category": None,
            "calorie_per_100g": round(food.calorie * factor, 2),
            "protein_per_100g": round(food.protein * factor, 2),
            "carb_per_100g": round(food.carb * factor, 2),
            "fat_per_100g": round(food.fat * factor, 2),
            "source": "frequent_food",
        })
    return results


def _compute_daily_totals(db: Session, user_id: str, record_date: date):
    totals = (
        db.query(
            func.coalesce(func.sum(MealRecord.total_calorie), 0).label("calorie"),
            func.coalesce(func.sum(MealRecord.total_protein), 0).label("protein"),
            func.coalesce(func.sum(MealRecord.total_carb), 0).label("carb"),
            func.coalesce(func.sum(MealRecord.total_fat), 0).label("fat"),
        )
        .filter(
            MealRecord.user_id == user_id,
            MealRecord.record_date == record_date,
            MealRecord.status == MealRecordStatus.confirmed,
        )
        .one()
    )
    return {
        "total_calorie": round(totals.calorie, 2),
        "total_protein": round(totals.protein, 2),
        "total_carb": round(totals.carb, 2),
        "total_fat": round(totals.fat, 2),
    }


def _build_food_items(db_items):
    return [
        {
            "id": item.id,
            "food_name": item.food_name,
            "food_category": item.food_category,
            "portion_desc": item.portion_desc,
            "weight_g": item.weight_g,
            "calorie": item.calorie,
            "protein": item.protein,
            "carb": item.carb,
            "fat": item.fat,
            "data_source": item.data_source.value if item.data_source else item.data_source,
            "is_user_modified": item.is_user_modified,
        }
        for item in db_items
        if not item.is_deleted
    ]


def confirm_meal(db: Session, user_id: str, req):
    meal_type = _to_meal_type(req.meal_type)
    source_type = _to_source_type(req.source_type)

    total_calorie = sum(item.calorie for item in req.food_items)
    total_protein = sum(item.protein for item in req.food_items)
    total_carb = sum(item.carb for item in req.food_items)
    total_fat = sum(item.fat for item in req.food_items)

    record = MealRecord(
        user_id=user_id,
        record_date=req.record_time.date(),
        record_time=req.record_time,
        meal_type=meal_type,
        source_type=source_type,
        total_calorie=total_calorie,
        total_protein=total_protein,
        total_carb=total_carb,
        total_fat=total_fat,
        status=MealRecordStatus.confirmed,
        is_saved_as_frequent=req.save_as_frequent,
    )
    db.add(record)
    db.flush()

    frequent_source = _to_frequent_source_type(req.source_type)
    now_ts = datetime.utcnow()
    for item in req.food_items:
        db.add(
            MealFoodItem(
                meal_record_id=record.id,
                user_id=user_id,
                food_name=item.food_name,
                food_category=None,
                portion_desc=item.portion_desc,
                weight_g=item.weight_g,
                calorie=item.calorie,
                protein=item.protein,
                carb=item.carb,
                fat=item.fat,
                data_source=_to_data_source(item.data_source),
                is_user_modified=False,
            )
        )
        if item.data_source == DataSource.frequent.value:
            frequent = (
                db.query(FrequentFood)
                .filter(
                    FrequentFood.user_id == user_id,
                    FrequentFood.food_name == item.food_name,
                    FrequentFood.status == FrequentStatus.active,
                )
                .first()
            )
            if frequent:
                frequent.use_count = (frequent.use_count or 0) + 1
                frequent.last_used_at = now_ts
        if req.save_as_frequent:
            existing = (
                db.query(FrequentFood)
                .filter(
                    FrequentFood.user_id == user_id,
                    FrequentFood.food_name == item.food_name,
                    FrequentFood.status == FrequentStatus.active,
                )
                .first()
            )
            if existing:
                existing.default_portion_desc = item.portion_desc
                existing.default_weight_g = item.weight_g
                existing.calorie = item.calorie
                existing.protein = item.protein
                existing.carb = item.carb
                existing.fat = item.fat
                existing.last_used_at = now_ts
            else:
                db.add(
                    FrequentFood(
                        user_id=user_id,
                        food_name=item.food_name,
                        default_portion_desc=item.portion_desc,
                        default_weight_g=item.weight_g,
                        calorie=item.calorie,
                        protein=item.protein,
                        carb=item.carb,
                        fat=item.fat,
                        source_type=frequent_source,
                    )
                )

    db.commit()
    db.refresh(record)
    daily_totals = _compute_daily_totals(db, user_id, record.record_date)
    return record, daily_totals


def get_records_by_date(db: Session, user_id: str, record_date: date):
    records = (
        db.query(MealRecord)
        .filter(
            MealRecord.user_id == user_id,
            MealRecord.record_date == record_date,
            MealRecord.status.in_([MealRecordStatus.confirmed]),
        )
        .order_by(MealRecord.record_time.asc())
        .all()
    )

    grouped = {}
    for meal_type in MealType:
        grouped[meal_type.value] = []

    for record in records:
        grouped[record.meal_type.value].append({
            "id": record.id,
            "meal_type": record.meal_type.value,
            "record_time": record.record_time,
            "source_type": record.source_type.value,
            "total_calorie": record.total_calorie,
            "total_protein": record.total_protein,
            "total_carb": record.total_carb,
            "total_fat": record.total_fat,
            "status": record.status.value,
            "food_items": _build_food_items(record.food_items),
        })

    daily_totals = _compute_daily_totals(db, user_id, record_date)
    return {
        "date": record_date.isoformat(),
        "grouped_records": grouped,
        "daily_totals": daily_totals,
    }


def _get_record(db: Session, user_id: str, record_id: str):
    record = db.query(MealRecord).filter(MealRecord.id == record_id).first()
    if not record or record.user_id != user_id:
        raise AppException(40004, "记录不存在")
    return record


def update_meal(db: Session, user_id: str, record_id: str, req):
    record = _get_record(db, user_id, record_id)

    if req.meal_type is not None:
        record.meal_type = _to_meal_type(req.meal_type)
    if req.record_time is not None:
        record.record_time = req.record_time
        record.record_date = req.record_time.date()

    if req.food_items is not None:
        for item in record.food_items:
            item.is_deleted = True

        total_calorie = sum(item.calorie for item in req.food_items)
        total_protein = sum(item.protein for item in req.food_items)
        total_carb = sum(item.carb for item in req.food_items)
        total_fat = sum(item.fat for item in req.food_items)

        record.total_calorie = total_calorie
        record.total_protein = total_protein
        record.total_carb = total_carb
        record.total_fat = total_fat

        for item in req.food_items:
            db.add(
                MealFoodItem(
                    meal_record_id=record.id,
                    user_id=user_id,
                    food_name=item.food_name,
                    food_category=None,
                    portion_desc=item.portion_desc,
                    weight_g=item.weight_g,
                    calorie=item.calorie,
                    protein=item.protein,
                    carb=item.carb,
                    fat=item.fat,
                    data_source=_to_data_source(item.data_source),
                    is_user_modified=True,
                )
            )

    db.commit()
    db.refresh(record)
    return record


def delete_meal(db: Session, user_id: str, record_id: str):
    record = _get_record(db, user_id, record_id)
    record.status = MealRecordStatus.deleted
    db.commit()
    return record


def revoke_meal(db: Session, user_id: str, record_id: str):
    latest = (
        db.query(MealRecord)
        .filter(
            MealRecord.user_id == user_id,
            MealRecord.status == MealRecordStatus.confirmed,
        )
        .order_by(MealRecord.created_at.desc())
        .first()
    )
    if not latest or latest.id != record_id:
        raise AppException(40005, "只能撤销最近一次饮食记录")
    record = _get_record(db, user_id, record_id)
    record.status = MealRecordStatus.revoked
    db.commit()
    return record


def list_frequent_foods(db: Session, user_id: str):
    from sqlalchemy import case
    return (
        db.query(FrequentFood)
        .filter(
            FrequentFood.user_id == user_id,
            FrequentFood.status == FrequentStatus.active,
        )
        .order_by(
            case(
                (FrequentFood.last_used_at.is_(None), 1),
                else_=0
            ),
            FrequentFood.last_used_at.desc()
        )
        .all()
    )


def create_frequent_food(db: Session, user_id: str, payload):
    food = FrequentFood(
        user_id=user_id,
        food_name=payload.food_name,
        default_portion_desc=payload.default_portion_desc,
        default_weight_g=payload.default_weight_g,
        calorie=payload.calorie,
        protein=payload.protein,
        carb=payload.carb,
        fat=payload.fat,
        source_type=_to_frequent_source_type(payload.source_type),
    )
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


def delete_frequent_food(db: Session, user_id: str, food_id: str):
    food = (
        db.query(FrequentFood)
        .filter(FrequentFood.id == food_id, FrequentFood.user_id == user_id)
        .first()
    )
    if not food:
        raise AppException(40004, "常吃的食物不存在")
    food.status = FrequentStatus.deleted
    db.commit()
    return food
