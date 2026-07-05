from datetime import date as date_today
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.response import success_response
from app.models.user import UserAccount
from app.services.home import get_dashboard_data
from app.utils.time import parse_date

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    date: str = None,
    db: Session = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    if not date:
        query_date = date_today.today()
    else:
        try:
            query_date = parse_date(date)
        except ValueError:
            raise AppException(40003, "参数错误", {"field": "date"})

    data = get_dashboard_data(db, current_user.user_id, query_date)
    return success_response(data)
