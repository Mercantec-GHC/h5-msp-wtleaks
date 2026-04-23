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

class MessageCreate(BaseModel):
    room_id: int
    content: str    