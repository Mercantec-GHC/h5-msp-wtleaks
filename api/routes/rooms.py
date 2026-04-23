from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_db
from src.models import Room
from src.schemas import RoomCreate

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("/")
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    new_room = Room(
        name=room.name,
        is_private=room.is_private,
    )

    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    return new_room


@router.get("/")
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()