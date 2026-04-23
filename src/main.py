from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.database import engine
from src.models import Base

from api.routes import auth, rooms, messages
from sockets.server import sio


import socketio

# lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# routes
app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(messages.router)


# combine FastAPI and Socket.IO apps
app = socketio.ASGIApp(
    sio,
    other_asgi_app=app,
)

print(engine.url)


