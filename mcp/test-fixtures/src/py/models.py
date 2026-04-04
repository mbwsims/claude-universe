from dataclasses import dataclass
from typing import Optional


@dataclass
class UserModel:
    id: str
    email: str
    name: str
    role: str = "user"

    @classmethod
    def create(cls, email: str, name: str) -> "UserModel":
        return cls(id=f"user-{id(email)}", email=email, name=name)

    @classmethod
    def find_by_id(cls, user_id: str) -> Optional["UserModel"]:
        return None

    @classmethod
    def delete_all(cls) -> None:
        pass
