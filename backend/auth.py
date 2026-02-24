"""
SupplySight — Authentication & Authorization Module
JWT-based auth with email/password support.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt

from backend.database import get_db

# ─── Configuration ──────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "supplysight-dev-secret-change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
ADMIN_INVITE_CODE = os.getenv("ADMIN_INVITE_CODE", "SUPPLYSIGHT_ADMIN_2026")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# ─── Password Hashing ──────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


# ─── Pydantic Schemas ──────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    company_id: Optional[int] = None
    admin_invite_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


# ─── JWT Helpers ────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ─── Current User Dependency ───────────────────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    """Extract and validate the current user from JWT token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = db.execute(
        text("SELECT user_id, email, full_name, role, company_id, avatar_url FROM app_user WHERE user_id = :id"),
        {"id": user_id},
    )
    user = result.fetchone()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return dict(user._mapping)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user is an admin."""
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ─── Auth Router ────────────────────────────────────────────────────
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if email already exists
    existing = db.execute(
        text("SELECT user_id FROM app_user WHERE email = :email"),
        {"email": req.email},
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Determine role
    role = "company"
    if req.admin_invite_code:
        if req.admin_invite_code == ADMIN_INVITE_CODE:
            role = "admin"
        else:
            raise HTTPException(status_code=400, detail="Invalid admin invite code")

    # Validate company_id for company users
    if role == "company" and not req.company_id:
        raise HTTPException(status_code=400, detail="Company selection required for company users")

    if role == "company" and req.company_id:
        company = db.execute(
            text("SELECT company_id FROM company WHERE company_id = :id"),
            {"id": req.company_id},
        ).fetchone()
        if not company:
            raise HTTPException(status_code=400, detail="Invalid company ID")

    # Hash password and insert user
    hashed = pwd_context.hash(req.password)
    result = db.execute(
        text("""
            INSERT INTO app_user (email, password_hash, full_name, role, company_id, auth_provider)
            VALUES (:email, :password_hash, :full_name, :role, :company_id, 'email')
            RETURNING user_id, email, full_name, role, company_id, avatar_url
        """),
        {
            "email": req.email,
            "password_hash": hashed,
            "full_name": req.full_name,
            "role": role,
            "company_id": req.company_id if role == "company" else None,
        },
    )
    user = dict(result.fetchone()._mapping)
    db.commit()

    # Generate tokens
    token_data = {"user_id": user["user_id"], "role": user["role"], "company_id": user["company_id"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with email and password."""
    result = db.execute(
        text("SELECT user_id, email, full_name, role, company_id, avatar_url, password_hash FROM app_user WHERE email = :email"),
        {"email": req.email},
    )
    user_row = result.fetchone()
    if not user_row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = dict(user_row._mapping)

    if not user["password_hash"]:
        raise HTTPException(status_code=401, detail="This account uses Google Sign-In. Please use Google to log in.")

    if not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last_login
    db.execute(
        text("UPDATE app_user SET last_login = NOW() WHERE user_id = :id"),
        {"id": user["user_id"]},
    )
    db.commit()

    # Remove password_hash from response
    user.pop("password_hash", None)

    token_data = {"user_id": user["user_id"], "role": user["role"], "company_id": user["company_id"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=user,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest, db: Session = Depends(get_db)):
    """Get a new access token using a refresh token."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("user_id")
    result = db.execute(
        text("SELECT user_id, email, full_name, role, company_id, avatar_url FROM app_user WHERE user_id = :id"),
        {"id": user_id},
    )
    user = result.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    user_dict = dict(user._mapping)
    token_data = {"user_id": user_dict["user_id"], "role": user_dict["role"], "company_id": user_dict["company_id"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=user_dict,
    )


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return current_user


# ─── Google OAuth ──────────────────────────────────────────────────
class GoogleLoginRequest(BaseModel):
    id_token: str
    company_id: Optional[int] = None


@router.post("/google", response_model=TokenResponse)
def google_login(req: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Authenticate with Google ID token. Auto-registers new users."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID in .env",
        )

    # Verify the Google ID token
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        idinfo = google_id_token.verify_oauth2_token(
            req.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

    google_id = idinfo.get("sub")
    email = idinfo.get("email")
    full_name = idinfo.get("name", email.split("@")[0])
    avatar_url = idinfo.get("picture")

    if not email:
        raise HTTPException(status_code=401, detail="Google token missing email")

    # Check if user exists (by google_id or email)
    result = db.execute(
        text("SELECT user_id, email, full_name, role, company_id, avatar_url FROM app_user WHERE google_id = :gid OR email = :email"),
        {"gid": google_id, "email": email},
    )
    user = result.fetchone()

    if user:
        # Existing user — update avatar and last_login
        user_dict = dict(user._mapping)
        db.execute(
            text("UPDATE app_user SET last_login = NOW(), avatar_url = :avatar, google_id = :gid WHERE user_id = :id"),
            {"avatar": avatar_url, "gid": google_id, "id": user_dict["user_id"]},
        )
        db.commit()
        user_dict["avatar_url"] = avatar_url
    else:
        # Auto-register new Google user
        role = "company"
        company_id = req.company_id

        insert_result = db.execute(
            text("""
                INSERT INTO app_user (email, full_name, role, company_id, auth_provider, google_id, avatar_url)
                VALUES (:email, :full_name, :role, :company_id, 'google', :google_id, :avatar_url)
                RETURNING user_id, email, full_name, role, company_id, avatar_url
            """),
            {
                "email": email,
                "full_name": full_name,
                "role": role,
                "company_id": company_id,
                "google_id": google_id,
                "avatar_url": avatar_url,
            },
        )
        user_dict = dict(insert_result.fetchone()._mapping)
        db.commit()

    token_data = {"user_id": user_dict["user_id"], "role": user_dict["role"], "company_id": user_dict["company_id"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        user=user_dict,
    )
