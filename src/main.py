import socketio
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

# Initialize Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",   
)

# FastAPI app
fastapi_app = FastAPI()

@fastapi_app.get("/", response_class=HTMLResponse)
def root():
    with open("src/index.html", "r") as f:
        return f.read()

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

@sio.event
async def connect(sid, environ):
    print(f"User connected: {sid}")

@sio.event
async def join_room(sid, room):
    await sio.enter_room(sid, room)

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
        