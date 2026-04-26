from fastapi import HTTPException
from src.models import Room, RoomRole


ROLE_POWER = {
    "member": 0,
    "moderator": 1,
    "admin": 2,
    "owner": 3
}

def get_room_role(db, room_id, user_id):
    room = db.query(Room).filter(Room.id == room_id).first()

    if not room:
        raise HTTPException(404, "Room not found")

    if room.owner_id == user_id:
        return "owner"

    role = db.query(RoomRole).filter(
        RoomRole.room_id == room_id,
        RoomRole.user_id == user_id
    ).first()

    if role:
        return role.role

    return "member"


def require_role(db, room_id, user_id, minimum_role):
    current = get_room_role(db, room_id, user_id)

    if ROLE_POWER[current] < ROLE_POWER[minimum_role]:
        raise HTTPException(403, "Not enough permission")