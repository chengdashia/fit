from datetime import datetime, date, timezone


def now() -> datetime:
    return datetime.now(timezone.utc)


def parse_date(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def parse_datetime(iso: str) -> datetime:
    if iso.endswith("Z"):
        iso = iso[:-1] + "+00:00"
    return datetime.fromisoformat(iso)
