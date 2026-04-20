from psutil import users
from pydantic import BaseModel
import socketio
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi import HTTPException
from jose import jwt
from datetime import datetime, timedelta

SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(data: dict):
    to_encode = data.copy()



# Initialize Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",   
)

# FastAPI app
fastapi_app = FastAPI()

# Serve the HTML page
@fastapi_app.get("/", response_class=HTMLResponse)
def root():
    with open("src/index.html", "r") as f:
        return f.read()

# Manifest for Chrome DevTools
@fastapi_app.get("/.well-known/appspecific/com.chrome.devtools.json")
def chrome_devtools_manifest():
    return {
        "name": "Chat App",
        "short_name": "ChatApp",
        "start_url": "/",
        "display": "standalone",
        "theme_color": "#ffffff",
        "background_color": "#ffffff"
    }

# Combine Socket.IO server with FastAPI app
app = socketio.ASGIApp(
    sio,
    other_asgi_app=fastapi_app,
)

# Socket events

# Handle new connections
@sio.event
async def connect(sid, environ):
    print(f"User connected: {sid}")

# Handle login event
@sio.event
async def login(sid, data):
    username = data["username"]
    code = data["code"]

    if username in users and users[username] == code:
        await sio.emit("login_success", {"ok": True}, to=sid)
    else: 
        await sio.emit("login_failed", {"ok": False}, to=sid)    

# Handle joining a room
@sio.event
async def join_room(sid, room):
    await sio.enter_room(sid, room)

# Handle incoming messages and broadcast to the room
@sio.event
async def message(sid, data):
    room = data["room"]
    msg = data["message"]

    await sio.emit("message", {
        "message": msg,
        "sender": sid,
    }, room=room)        

@sio.event
async def disconnect(sid):
    print(f"User disconnected: {sid}")


users = {}

# User model for signup
class user(BaseModel):
    username: str
    code: str

# Signup endpoint
@fastapi_app.post("/signup")
def signup(user: user):
    if user.username in users:
        return {"error": "Username already exists"}
    
    users[user.username] = user.code
    return {"message": "User created successfully"}

# Login model for login endpoint
class login(BaseModel):
    username: str
    code: str

# Login endpoint
@fastapi_app.post("/login")
def login(data: login):
    if data.username not in users:
        raise HTTPException(status_code=401, detail="User not found")
    
    if users[data.username] != data.code:
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    return {
        "message": "Login successful",
        "token": data.username
    }

# Socket.IO event for handling new connections with authentication
@sio.event
async def connect(sid, environ, auth=None):
    token = None

    if auth:
        token = auth.get("token")

    if not token:
        print("Rejected connection: No token provided")
        return False

    print(f"User connected: {sid} with token: {token}")    

# Socket.IO event for handling messages with user information
@sio.event
async def message(sid, data):
    session = await sio.get_session(sid)
    username = session["username"]

    await sio.emit("message", {
        "user": username,
        "message": data["message"]
    })


