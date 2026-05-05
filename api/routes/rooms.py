from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from core.jwt import get_current_user, hash_password, verify_password
from core.permissions import require_role
from src.schemas import RoomCreate, JoinRoomRequest
from src.models import Room, User

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("/")
def create_room(
    room: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_room = Room(
        name=room.name,
        is_private=True if room.password else room.is_private,
        owner_id=current_user.id,
        password_hash=hash_password(room.password) if room.password else None
    )

    db.add(new_room)
    db.commit()
    db.refresh(new_room)

    return {
        "id": new_room.id,
        "name": new_room.name,
        "is_private": new_room.is_private
    }


@router.post("/{room_id}/join")
def join_room(
    room_id: int,
    data: JoinRoomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    if room.password_hash:
        if not data.password or not verify_password(data.password, room.password_hash):
            raise HTTPException(403, "Invalid room password")

    if current_user not in room.users:
        room.users.append(current_user)

    db.commit()

    return {"status": "joined"}


@router.delete("/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    require_role(db, room_id, current_user.id, "owner")

    db.delete(room)
    db.commit()

    return {"status": "room deleted"}

@router.delete("/{room_id}/users/{user_id}")
def kick_user(
    room_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_role(db, room_id, current_user.id, "admin")

    room = db.query(Room).filter(Room.id == room_id).first()
    user = db.query(User).filter(User.id == user_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    if not user:
        raise HTTPException(404, "User not found")

    if user not in room.users:
        raise HTTPException(400, "User not in room")

    if room.owner_id == user.id:
        raise HTTPException(403, "Cannot kick owner")

    room.users.remove(user)

    db.commit()

    return {"status": "user removed"}

@router.get("/my")
def get_my_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rooms = current_user.rooms

    return [
        {
            "id": room.id,
            "name": room.name,
            "members": [
                {
                    "id": user.id,
                    "display_name": user.display_name
                }
                for user in room.users
            ]
        }

        for room in rooms
    ]   


@router.get("/{room_id}")
def get_room_details(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    if current_user not in room.users:
        raise HTTPException(403, "Not member of room")

    return {
        "id": room.id,
        "name": room.name,
        "owner_id": room.owner_id,

        "members": [
            {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name
            }
            for user in room.users
        ],

        "messages": [
            {
                "id": msg.id,
                "content": ( "[deleted by user]" if msg.status == "deleted_user"
                else "[deleted by admin]" if msg.status == "deleted_admin"
                else msg.content
                ),
                "status": msg.status,
                "sender_id": msg.sender_id
            }
            for msg in room.messages
        ]
    }   

@router.post("/{room_id}/leave")
def leave_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    if current_user not in room.users:
        raise HTTPException(400, "You are not in this room")

    # Optional: prevent owner from leaving
    if room.owner_id == current_user.id:
        raise HTTPException(400, "Owner cannot leave their own room")

    room.users.remove(current_user)
    db.commit()

    return {"status": "left room"}

@router.get("/")
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()