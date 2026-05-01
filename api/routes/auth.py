from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.schemas import UserCreate, UserLogin
from src.models import RefreshToken, User
from api.deps import get_db
from core.jwt import ALGORITHM, SECRET_KEY, create_refresh_token, get_current_user, hash_password, verify_password, create_access_token
from jose import jwt, JWTError

# This file contains the authentication routes for user signup, login, token refresh, and logout.
router = APIRouter(prefix="/auth", tags=["auth"])

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
        display_name=user.username,
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
    
    db.token.revoked = True

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
    db.delete(current_user)
    db.commit()

    return {"status": "user deleted"}