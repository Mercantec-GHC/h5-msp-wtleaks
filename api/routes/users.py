from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.models import User
from api.deps import get_db
from core.jwt import get_current_user

router = APIRouter()


@router.delete("/users/me")
def delete_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.delete(current_user)
    db.commit()

    return {"status": "user deleted"}

@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "username": current_user.username,
        "display_name": current_user.display_name
    }

@router.get("/users/{user_id}")
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(404, "User not found")

    return {
        "username": user.username,
        "display_name": user.display_name
    }