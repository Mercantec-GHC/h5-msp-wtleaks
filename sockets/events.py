from sockets.server import sio
from core.jwt import verify_token


@sio.event
async def connect(sid, environ, auth=None):
    token = auth.get("token") if auth else None

    if not token:
        return False

    payload = verify_token(token)
    if not payload:
        return False

    await sio.save_session(sid, {"username": payload["sub"]})


@sio.event
async def message(sid, data):
    session = await sio.get_session(sid)

    await sio.emit("message", {
        "user": session["username"],
        "message": data["message"]
    })

def sio_app(app):
    return sio.ASGIApp(sio, other_asgi_app=app)    