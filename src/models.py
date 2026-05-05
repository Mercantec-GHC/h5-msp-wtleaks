from sqlalchemy import Column, Integer, String, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from src.database import Base
from sqlalchemy import DateTime, Text
from datetime import datetime

# Association table for many-to-many relationship between users and rooms
user_room = Table(
    "user_room",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("room_id", Integer, ForeignKey("rooms.id"), primary_key=True)
)

# User model with relationships to rooms and messages
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    hashed_code = Column(String, nullable=False)
    role = Column(String, nullable=False)

    # Relationships
    rooms = relationship("Room", secondary=user_room, back_populates="users")
    messages = relationship("Message", back_populates="sender")

# Association table for many-to-many relationship between rooms and moderators
moderators_table = Table(
    "room_moderators",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("room_id", Integer, ForeignKey("rooms.id"), primary_key=True)
)    

# Room model with relationships to users and messages
class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_private = Column(Boolean, default=False)

    owner_id = Column(Integer, ForeignKey("users.id"))

    password_hash = Column(Integer, nullable=False)
    # Relationships
    owner = relationship("User")
    users = relationship("User", secondary=user_room, back_populates="rooms")
    moderators = relationship("User", secondary=moderators_table, back_populates="rooms")
    
    # When a room is deleted, all associated messages will also be deleted due to the cascade option.
    messages = relationship(
        "Message",
        back_populates="room",
        cascade="all, delete-orphan"
    )

# Message model with relationships to user and room
class Message(Base): 
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Status of the message, can be "ok", "deleted_user", or "deleted_admin"
    status = Column(String, default="ok")
    # "ok", "deleted_user", "deleted_admin"

    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))

    # Relationships
    sender = relationship("User", back_populates="messages")
    room = relationship("Room", back_populates="messages")

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True)
    token = Column(String, unique=True, nullable=False)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User")

    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)    

class RoomRole(Base):
    __tablename__ = "room_roles"

    id = Column(Integer, primary_key=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String, nullable=False)    