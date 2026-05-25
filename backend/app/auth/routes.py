from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth.service import (
    login_user,
    logout_user,
    refresh_access_token,
    register_user,
    resend_verification_code,
    verify_email,
    verify_login_challenge,
)
from app.core.request_context import get_request_context
from app.db.session import get_db

router = APIRouter(tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class LoginChallengeRequest(BaseModel):
    email: EmailStr
    code: Annotated[str, Field(min_length=4, max_length=12)]


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None
    all_devices: bool = False


@router.post("/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    return register_user(db, payload.email, payload.password)


@router.get("/verify")
def verify(token: str, db: Session = Depends(get_db)):
    return verify_email(db, token)


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    context = get_request_context(request)
    return login_user(
        db,
        payload.email,
        payload.password,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )


@router.post("/login/challenge")
def login_challenge(payload: LoginChallengeRequest, request: Request, db: Session = Depends(get_db)):
    context = get_request_context(request)
    return verify_login_challenge(
        db,
        payload.email,
        payload.code,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    return resend_verification_code(db, payload.email)


@router.post("/refresh")
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    context = get_request_context(request)
    return refresh_access_token(
        db,
        payload.refresh_token,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
    )


@router.post("/logout")
def logout(payload: LogoutRequest, request: Request, db: Session = Depends(get_db)):
    context = get_request_context(request)
    return logout_user(
        db,
        refresh_token=payload.refresh_token,
        ip_address=context.ip_address,
        user_agent=context.user_agent,
        all_devices=payload.all_devices,
    )
