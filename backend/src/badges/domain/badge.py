from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

Kind = Literal["auto", "event"]
EVENT_PREFIX = "event_"
EVENT_ICON = "🎪"
NEW_DAYS = 7  # 받은 지 7일 안 된 뱃지는 도감에 NEW
WEEKLY = "top_buyer"  # 매주 다시 정하고 저장하지 않는 뱃지
MAX_GRANT = 50

# 진행 막대가 있는 뱃지: 코드 → (기록 이름, 목표) — BADGES.md 2장 "진행도"
GOALS: dict[str, tuple[str, int]] = {
    "first_order": ("orders", 1),
    "first_trade": ("trades", 1),
    "reviewer": ("reviews", 3),
    "collector": ("categories", 4),
    "santa": ("gifts", 3),
    "regular": ("hearts", 3),
    "trader_1": ("trades", 10),
    "hearts_1": ("hearts", 10),
    "trader_2": ("trades", 30),
    "hearts_2": ("hearts", 50),
    "trader_3": ("trades", 100),
    "hearts_3": ("hearts", 99),
}


class BadgeNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("뱃지를 찾을 수 없어요.")


class NotEarned(Exception):
    """받지 않은 뱃지를 대표로 고를 때 (400)"""

    def __init__(self) -> None:
        super().__init__("아직 받지 않은 뱃지예요.")


class BadgeRuleError(Exception):
    """자동 뱃지 수정 · 지급 · 회수, 꺼 둔 뱃지 지급처럼 규칙에 어긋날 때 (400)"""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class NotHolder(Exception):
    def __init__(self) -> None:
        super().__init__("이 뱃지를 가진 사용자가 아니에요.")


@dataclass(frozen=True)
class BadgeInfo:
    code: str
    name: str
    description: str
    image: str
    icon: str
    rank: int
    kind: Kind
    is_active: bool = True


@dataclass(frozen=True)
class Owned:
    code: str
    earned_at: datetime
    memo: str | None = None


@dataclass(frozen=True)
class Progress:
    current: int
    goal: int


@dataclass(frozen=True)
class BookItem:
    info: BadgeInfo
    earned: bool
    earned_at: datetime | None
    is_new: bool
    is_weekly: bool
    progress: Progress | None
    granted_memo: str | None


@dataclass(frozen=True)
class Book:
    items: list[BookItem]
    featured: str | None

    @property
    def earned_count(self) -> int:
        return sum(1 for i in self.items if i.earned)


def is_event(code: str) -> bool:
    return code.startswith(EVENT_PREFIX)


def progress_of(code: str, records: dict[str, int]) -> Progress | None:
    """진행도가 '—'인 뱃지면 None. 목표를 넘은 값은 목표로 맞춘다"""
    if code not in GOALS:
        return None
    field, goal = GOALS[code]
    return Progress(min(records.get(field, 0), goal), goal)


def is_new(earned_at: datetime | None, now: datetime) -> bool:
    return earned_at is not None and now - earned_at < timedelta(days=NEW_DAYS)


def check_can_feature(code: str, owned: set[str]) -> None:
    if code not in owned:
        raise NotEarned()


def resolve_featured(chosen: str | None, owned: list[BadgeInfo]) -> str | None:
    """내가 고른 것 → 안 골랐거나 이제 없으면 가장 받기 어려운 것(rank 최대)"""
    codes = {b.code for b in owned}
    if chosen in codes:
        return chosen
    best = max(owned, key=lambda b: b.rank, default=None)
    return best.code if best else None


def next_event_code(existing: list[str]) -> str:
    numbers = [int(c[len(EVENT_PREFIX) :]) for c in existing if is_event(c) and c[len(EVENT_PREFIX) :].isdigit()]
    return f"{EVENT_PREFIX}{max(numbers, default=0) + 1}"


def check_event_badge(info: BadgeInfo, action: str) -> None:
    """이벤트 뱃지만 관리자가 바꾸고 · 주고 · 회수한다"""
    if info.kind == "auto":
        raise BadgeRuleError("자동 뱃지는 코드로 관리돼요.")
    if action == "grant" and not info.is_active:
        raise BadgeRuleError("꺼 둔 뱃지는 줄 수 없어요.")
