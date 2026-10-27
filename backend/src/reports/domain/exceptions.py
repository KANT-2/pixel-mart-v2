class ReportTargetNotFound(Exception):
    """신고하려는 거래글 · 리뷰 · 문의 · 아바타가 없을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("신고할 대상을 찾을 수 없어요.")


class CannotReport(Exception):
    """내가 올린 내용을 신고하려 할 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("내가 올린 내용은 신고할 수 없어요.")


class AlreadyReported(Exception):
    """같은 대상에 이미 처리 대기 중인 내 신고가 있을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("이미 신고한 내용이에요.")


class ReportNotFound(Exception):
    """관리자가 처리하려는 신고가 없을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("신고를 찾을 수 없어요.")


class ReportAlreadyHandled(Exception):
    """이미 처리(숨김 · 기각)한 신고를 다시 처리하려 할 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("이미 처리한 신고예요.")
