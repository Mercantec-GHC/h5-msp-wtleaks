from psutil import users
from pydantic import BaseModel
import socketio
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi import HTTPException
from jose import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from src.database import engine
from src.database import Sessionlocal
from src.models import Base
from fastapi import Depends
from sqlalchemy.orm import Session
from src.models import User
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
from sqlalchemy import text



fastapi_app = FastAPI()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # wait until db is ready
    for i in range(20):
        try:
            # force real connection test
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))

            # create tables AFTER connection is confirmed
            Base.metadata.create_all(bind=engine)

            print("Database is ready + tables created!")
            break

        except Exception as e:
            print(f"DB not ready ({i+1}/20): {e}")
            time.sleep(2)

    yield

app = FastAPI(lifespan=lifespan)    

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def get_db():
    db = Sessionlocal()
    try:
        yield db
    finally:
        db.close()    

# Function to create JWT access token
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Function to verify JWT token
def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        return None

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password[:72])  # bcrypt has a maximum password length of 72 bytes

def verify_password(plain: str, hashed: str):
    return pwd_context.verify(plain, hashed)

# Initialize Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",   
)


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
    
# Handle disconnections
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
def signup(user: user, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.username == user.username).first()

    if existing_user:
        return {"error": "Username already exists"}
    
    new_user = User(
        username=user.username,
        hashed_code=hash_password(user.code)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

# Login model for login endpoint
class login(BaseModel):
    username: str
    code: str

# Login endpoint
@fastapi_app.post("/login")
def login(data: login, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not verify_password(data.code, user.hashed_code):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    token = create_access_token({"sub": data.username})
    
    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer"
    }

# Socket.IO event for handling new connections with authentication
@sio.event
async def connect(sid, environ, auth=None):
    token = auth.get("token") if auth else None

    if not token:
        print("No token provided, rejecting connection")
        return False
    
    payload = verify_token(token)

    if not payload:
        print("invalid token, rejecting connection")
        return False
    
    username = payload["sub"]

    await sio.save_session(sid, {"username": username})

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


