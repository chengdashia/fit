from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "健身饮食记录"
    DEBUG: bool = False
    SECRET_KEY: str = "fit-mini-program-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30
    AUTO_CREATE_TABLES: bool = True
    SEED_FOODS_ON_STARTUP: bool = True
    
    # MySQL
    MYSQL_HOST: str = "mysql6.sqlpub.com"
    MYSQL_PORT: int = 3311
    MYSQL_USER: str = "root_fit"
    MYSQL_PASSWORD: str = "Qajz4zjO3RrK5z5n"
    MYSQL_DATABASE: str = "fit_database"
    DATABASE_URL_OVERRIDE: str | None = None
    
    # WeChat (MVP mock supported)
    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""
    WECHAT_MOCK_OPENID: bool = True
    
    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        return (
            f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            f"?charset=utf8mb4"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
