from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.deps import get_db
from core.jwt import get_current_user
from core.permissions import ROLE_POWER, get_room_role
from src.models import Message, Room, User
from src.schemas import MessageCreate

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/")
def create_message(msg: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    # Verify room exists
    room = db.query(Room).filter(Room.id == msg.room_id).first()
    if not room:
        raise HTTPException(404, "Room not found")

    # Verify user is a member of the room
    if current_user not in room.users:
        raise HTTPException(403, "Not a member of the room")

    # Create and save the message
    new_msg = Message(
        content=msg.content,
        room_id=msg.room_id,
        sender_id= current_user.id
    )

    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return new_msg

@router.get("/room/{room_id}")
def get_messages(room_id: int, db: Session = Depends(get_db)):
    return db.query(Message).filter(Message.room_id == room_id).all()


@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(404, "Message not found")

    # Sender can always delete own message
    if message.sender_id == current_user.id:
        message.status = "deleted_user"
        delete_type = "user"

    else:
        # Otherwise need moderator+
        role = get_room_role(db, message.room_id, current_user.id)

        if ROLE_POWER[role] < ROLE_POWER["moderator"]:
            raise HTTPException(403, "Not allowed")

        message.status = "deleted_admin"
        delete_type = "admin"
    db.commit()

    return {"status": "message deleted", "type": delete_type}