from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from core.jwt import get_current_user, hash_password, verify_password
from src.models import Room, User
from src.schemas import RoomCreate

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("/")
def create_room(
    name: str,
    password: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = Room(
        name=name,
        owner_id=current_user.id,
        password_hash=hash_password(password) if password else None
    )
    db.add(room)
    db.commit()
    db.refresh()

    return room


@router.post("/{room_id}/join")
def join_room(
    room_id: int,
    password: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    #  only check if room is protected
    if room.password_hash:
        if not password or not verify_password(password, room.password_hash):
            raise HTTPException(403, "Invalid room password")

    if current_user not in room.users:
        room.users.append(current_user)

    db.commit()

    return {"status": "joined"}

@router.delete("/rooms/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    if room.owner_id != current_user.id:
        raise HTTPException(403, "Not allowed")

    db.delete(room)
    db.commit()

    return {"status": "room deleted"}

@router.get("/")
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()