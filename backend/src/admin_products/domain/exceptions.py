class AdminProductNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("상품을 찾을 수 없어요.")


class InvalidProductCategory(Exception):
    def __init__(self) -> None:
        super().__init__("카테고리를 찾을 수 없어요.")
