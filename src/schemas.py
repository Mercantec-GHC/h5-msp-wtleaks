from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    display_name: str = None
    code: str

class UserLogin(BaseModel):
    username: str
    code: str

class RoomCreate(BaseModel):
    name: str
    is_private: bool = False
    password: str | None = None

class MessageCreate(BaseModel):
    room_id: int
    content: str    

class JoinRoomRequest(BaseModel):
    password: str | None = None

class UpdateRequest(BaseModel):
    username: str | None = None
    display_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None    