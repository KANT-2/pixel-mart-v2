from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# 공개 저장소에 적힌 기본값 — 로컬 개발에서만 쓰고, 배포(ENV가 local이 아님)에서는 거부한다
DEFAULT_JWT_SECRET = "local-dev-secret-change-me-please-32chars"


class Settings(BaseSettings):
    """환경 변수 / backend/.env 에서 읽는 설정값 (.env.example 참고)"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    env: str = "local"
    database_url: str = "postgresql+asyncpg://pixelmart:pixelmart@localhost:5432/pixelmart"
    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_expire_minutes: int = 60 * 24 * 7  # 7일
    frontend_url: str = "http://localhost:3000"
    google_client_id: str = ""
    google_client_secret: str = ""
    # AI 픽셀 아바타 — Cloudflare Workers AI(무료 일일 할당). 값이 없으면 AI 만들기만 꺼지고 나머지 기능은 그대로
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_image_model: str = "@cf/black-forest-labs/flux-2-klein-4b"
    ai_avatar_per_hour: int = 0  # 사용자별 1시간 횟수 제한, 0이면 제한 없음 (무료 일일 할당 약 300장)

    @property
    def is_local(self) -> bool:
        return self.env == "local"

    def ensure_deployable(self) -> "Settings":
        """기본 비밀값은 누구나 볼 수 있어서, 배포에서 쓰면 로그인 토큰을 위조할 수 있다 → 서버 시작을 막는다.

        pydantic 검증 오류는 입력값(DB 주소 등)을 같이 찍으므로, 안내 문장만 나가게 따로 검사한다.
        """
        if not self.is_local and (self.jwt_secret == DEFAULT_JWT_SECRET or len(self.jwt_secret) < 32):
            raise RuntimeError("ENV가 local이 아니면 JWT_SECRET을 기본값이 아닌 32자 이상 비밀값으로 설정해야 해요.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings().ensure_deployable()


settings = get_settings()
