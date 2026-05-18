from datetime import datetime
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, FastAPI
from sqlalchemy.orm import Session
from pydantic import BaseModel
from minio import Minio
from src.schemas import UpdateRequest, UserCreate, UserLogin, DisplayNameUpdate
from src.models import RefreshToken, User
from api.deps import get_db
from core.jwt import ALGORITHM, SECRET_KEY, create_refresh_token, get_current_user, hash_password, verify_password, create_access_token
from jose import jwt, JWTError

# This file contains the authentication routes for user signup, login, token refresh, and logout.
router = APIRouter(prefix="/auth", tags=["auth"])

app = FastAPI(max_request_size=10 * 1024 * 1024)
from minio import Minio

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

client = Minio(
    "minio:9000",
    access_key="admin",
    secret_key="supersecretpassword",
    secure=False
)

# The signup route allows new users to create an account by providing a username and code. It checks if the username already exists and hashes the code before saving the user to the database.
@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    # If a user with the same username already exists, it raises a 400 error. Otherwise, it creates a new user, hashes the code, and saves it to the database.
    if existing:
        raise HTTPException(400, "Username exists")
    # The new user is created with the provided username and a hashed version of the code. The role is set to "user" by default. After saving the user, it returns a success message.
    new_user = User(
        username=user.username,
        display_name=user.display_name or user.username,
        hashed_code=hash_password(user.code),
        role="user"
    )
    # The new user is added to the database session, committed, and refreshed to get the new user's ID. Finally, a success message is returned.
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created"}

# The login route allows users to authenticate by providing their username and code. It verifies the credentials and, if valid, generates an access token and a refresh token for the user.
@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    # If the user is not found or the provided code does not match the stored hashed code, it raises a 401 error. If the credentials are valid, it creates an access token and a refresh token for the user and returns them in the response.
    if not user or not verify_password(data.code, user.hashed_code):
        raise HTTPException(401, "Invalid credentials")
    # Creates the access and refresh token
    access_token = create_access_token(user)
    refresh_token, expires = create_refresh_token(user)
    
    db_token = RefreshToken(
        user_id=user.id,
        token = refresh_token,
        expires_at=expires,
        revoked=False
    )
    
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

# The refresh token route allows users to obtain a new access token by providing a valid refresh token. It verifies the refresh token and, if valid, generates a new access token and a new refresh token for the user.
@router.post("/refresh")
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid refresh token"
    )
    # The route first verifies the provided refresh token. If the token is invalid or expired, it raises a 401 error. If the token is valid, it retrieves the user associated with the token and generates a new access token and a new refresh token for the user. The old refresh token is deleted from the database, and the new refresh token is saved. Finally, the new access token and refresh token are returned in the response.
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != "refresh":
            raise credentials_exception
        
        user_id = int(payload.get("sub"))

    
    except (JWTError, ValueError):
        raise credentials_exception
    # The route first verifies the provided refresh token. If the token is invalid or expired, it raises a 401 error. If the token is valid, it retrieves the user associated with the token and generates a new access token and a new refresh token for the user. The old refresh token is deleted from the database, and the new refresh token is saved. Finally, the new access token and refresh token are returned in the response.
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.revoked == False
    ).first()

    if not db_token:
        raise credentials_exception
    # If the token is valid, it retrieves the user associated with the token and generates a new access token and a new refresh token for the user. The old refresh token is deleted from the database, and the new refresh token is saved. Finally, the new access token and refresh token are returned in the response.
    if db_token.expires_at < datetime.utcnow():
        raise credentials_exception
    
    db_token.revoked = True

    # If the token is valid, it retrieves the user associated with the token and generates a new access token and a new refresh token for the user. The old refresh token is deleted from the database, and the new refresh token is saved. Finally, the new access token and refresh token are returned in the response.
    user = db.query(User).filter(User.id == user_id).first()

    new_access = create_access_token(user)
    new_refresh, expires = create_refresh_token(user)

    new_db_token = RefreshToken(
        token=new_refresh,
        user_id=user.id,
        expires_at=expires,
        revoked=False
    )
    
    db.add(new_db_token)
    db.commit()

    return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}

# The logout route allows users to log out by providing their refresh token. It deletes the provided refresh token from the database, effectively invalidating it and preventing it from being used to obtain new access tokens in the future. A success message is returned after the token is deleted.
@router.post("/logout")
def logout(refresh_token: str, db: Session = Depends(get_db)):

    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token).first()

    if db_token:
        db_token.revoked = True
        db.commit()

    return {"message": "Logged out"}        

@router.delete("/users/me")
def delete_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # create a unique anonymized username so unique constraints stay satisfied
    anon = f"deleted_user_{current_user.id}_{int(datetime.utcnow().timestamp())}"
    current_user.username = anon
    current_user.display_name = "Deleted user"
    current_user.hashed_code = None  # remove authentication secret

    # revoke or delete refresh tokens (keeps message rows intact)
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).update(
        {"revoked": True}
    )

    db.commit()
    return {"status": "user anonymized"}

@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "rooms_id": [room.id for room in current_user.rooms]
    }

@router.get("/users/{user_id}")
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(404, "User not found")

    return {
        "username": user.username,
        "display_name": user.display_name,
        "rooms_id": [room.id for room in user.rooms]
    }    

@router.patch("/update")
def update_me(
    data: UpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if data.username is not None:
        existing = db.query(User).filter(
            User.username == data.username,
            User.id != current_user.id
        ).first()

        if existing:
            raise HTTPException(400, "Username exists")
        
        current_user.username = data.username

    new_access = None
    new_refresh = None

    if data.new_password is not None:
        if not data.current_password:
            raise HTTPException(400, "Current password required")

        if not verify_password(
            data.current_password, 
            current_user.hashed_code
        ):
            
            raise HTTPException(400, "Current password incorrect")

        current_user.hashed_code = hash_password(data.new_password)

        db.query(RefreshToken).filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked == False
        ).update({
            "revoked": True
        })

        new_access = create_access_token(current_user)
        new_refresh, expires = create_refresh_token(current_user)

        db.add(
            RefreshToken(
                token=new_refresh,
                user_id=current_user.id,
                expires_at=expires,
                revoked=False
            )
        )

    db.commit()

    response = {
        "status": "profile updated",
    }

    if new_access:
        response["access_token"] = new_access
        response["refresh_token"] = new_refresh

    return response

@router.patch("/updateDisplay")
def update_display_name(
    data: DisplayNameUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.display_name = data.display_name
    db.commit()
    return {"status": "display name updated"} 

@router.post("/upload-profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...)
):
    object_name = file.filename
    logger.info(
        "upload_profile_picture called: filename=%s, content_type=%s",
        object_name,
        file.content_type,
    )

    contents = await file.read()
    logger.info("upload_profile_picture read file size=%d bytes", len(contents))

    from io import BytesIO

    try:
        client.put_object(
            "profil",
            object_name,
            BytesIO(contents),
            length=len(contents),
            content_type=file.content_type
        )
    except Exception as exc:
        logger.exception(
            "Failed to upload profile picture %s to MinIO",
            object_name,
        )
        raise HTTPException(500, "Failed to upload profile picture") from exc

    logger.info("upload_profile_picture successfully uploaded %s", object_name)

    return {
        "status": "uploaded",
        "file": object_name
    }