# CSV 내보내기용 순수 함수 — DB·FastAPI에 의존하지 않는다 (이슈 #99)
FORMULA_PREFIXES = ("=", "+", "-", "@")


def sanitize_csv_cell(value: str) -> str:
    """엑셀 등에서 수식으로 해석되지 않도록, =/+/-/@로 시작하면 앞에 작은따옴표를 붙인다(CSV 수식 주입 방지)."""
    if value and value[0] in FORMULA_PREFIXES:
        return f"'{value}"
    return value
