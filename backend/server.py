"""
Aroha — Digital Twin backend.

Independent Mode (Phase 1):
- Subjects (per user)
- Sessions with automatic behavioural tracking
- Twin profile (per subject) with predictions & post-session updates
- Robot evolution state (energy + stage)
- Twin Voice: Claude Sonnet 4.5 phrases pre-computed structured insights

Data store: MongoDB (env-driven). Repository pattern keeps swap to PostgreSQL trivial.
Auth: mock — every request carries `user_id` in query/body. JWT can be added at
the router-dependency level later without touching business logic.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import secrets
import socket
import string
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import urlparse

from dotenv import load_dotenv
import bcrypt
import jwt
from fastapi import APIRouter, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.environ.get("DB_NAME", "aroha")
ALLOW_MEMORY_DB = os.environ.get("ALLOW_MEMORY_DB", "").strip().lower() in {"1", "true", "yes"}
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929").strip()
ROBOT_NAME = "Reo"
CHAT_LLM_RETRY_AFTER: Optional[datetime] = None


async def anthropic_text(*, system: str, user: str, max_tokens: int, temperature: float = 0) -> str:
    """Call Anthropic directly. All behavioural facts are computed before this boundary."""
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    response = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(
        block.text for block in response.content
        if getattr(block, "type", None) == "text" and getattr(block, "text", None)
    ).strip()


def load_jwt_secret() -> str:
    configured = os.environ.get("JWT_SECRET", "").strip()
    if configured:
        if len(configured) < 32:
            raise RuntimeError("JWT_SECRET must contain at least 32 characters")
        return configured
    key_path = ROOT_DIR / ".aroha_jwt.key"
    if key_path.exists():
        return key_path.read_text(encoding="utf-8").strip()
    generated = secrets.token_urlsafe(48)
    key_path.write_text(generated, encoding="utf-8")
    return generated


JWT_SECRET = load_jwt_secret()
JWT_ALGORITHM = "HS256"
TOKEN_DAYS = 30

class MemoryCursor:
    def __init__(self, docs: List[Dict[str, Any]], sort_spec: Optional[List] = None):
        self.docs = docs
        self.sort_spec = sort_spec

    def sort(self, spec: List):
        self.sort_spec = spec
        return self

    async def to_list(self, limit: int = 200) -> List[Dict[str, Any]]:
        items = list(self.docs)
        if self.sort_spec:
            for field, direction in reversed(self.sort_spec):
                items.sort(key=lambda d: str(d.get(field, "")), reverse=direction == -1)
        return items[:limit]


class MemoryCollection:
    def __init__(self, name: str):
        self.name = name
        self.docs: List[Dict[str, Any]] = []

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        for doc in self.docs:
            if self._matches(doc, query):
                return self._project(doc, projection)
        return None

    def find(self, query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        docs = [doc for doc in self.docs if self._matches(doc, query)]
        return MemoryCursor([self._project(doc, projection) for doc in docs])

    async def insert_one(self, doc: Dict[str, Any]) -> None:
        self.docs.append(dict(doc))

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> None:
        target = next((doc for doc in self.docs if self._matches(doc, query)), None)
        if target is None:
            if upsert:
                new_doc = dict(query)
                for k, v in update.get("$set", {}).items():
                    new_doc[k] = v
                self.docs.append(new_doc)
            return
        if "$set" in update:
            for key, value in update["$set"].items():
                target[key] = value

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for key, expected in query.items():
            if isinstance(expected, dict):
                for op, value in expected.items():
                    if op == "$gte" and doc.get(key) is not None and doc.get(key) < value:
                        return False
                    if op == "$lte" and doc.get(key) is not None and doc.get(key) > value:
                        return False
                    if op == "$ne" and doc.get(key) == value:
                        return False
                    if op == "$in" and doc.get(key) not in value:
                        return False
            elif doc.get(key) != expected:
                return False
        return True

    def _project(self, doc: Dict[str, Any], projection: Optional[Dict[str, Any]]):
        if not projection:
            return dict(doc)

        excluded_fields = {k for k, v in projection.items() if v == 0}
        if excluded_fields:
            return {k: v for k, v in doc.items() if k not in excluded_fields}

        include_fields = {k for k, v in projection.items() if v == 1}
        if include_fields:
            return {k: doc[k] for k in doc if k in include_fields}

        return dict(doc)


class MemoryDB:
    def __init__(self):
        self.collections: Dict[str, MemoryCollection] = {}

    def __getitem__(self, name: str) -> MemoryCollection:
        if name not in self.collections:
            self.collections[name] = MemoryCollection(name)
        return self.collections[name]


def _mongo_is_available() -> bool:
    try:
        parsed = urlparse(MONGO_URL)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 27017
        with socket.create_connection((host, port), timeout=0.3):
            return True
    except Exception:
        return False


memory_db = MemoryDB()
client = None
db = memory_db
mongo_available = _mongo_is_available()

if mongo_available:
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
    except Exception:
        client = None
        db = memory_db
        mongo_available = False
else:
    client = None
    db = memory_db

app = FastAPI(title="Aroha Digital Twin API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
log = logging.getLogger("aroha")


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------
def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def parse_goal_units(goal: str) -> Optional[int]:
    """Extract a leading integer from a free-form goal, e.g. 'Solve 15 questions' -> 15."""
    if not goal:
        return None
    m = re.search(r"(\d+)", goal)
    return int(m.group(1)) if m else None


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class Subject(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    name: str
    color: str = "#F4A261"
    icon: str = "book-open"
    created_at: datetime = Field(default_factory=now)


class SubjectCreate(BaseModel):
    user_id: str
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None


class TwinProfile(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    subject_id: str
    sessions_count: int = 0
    avg_focus_seconds: float = 0.0
    avg_duration_seconds: float = 0.0
    avg_distraction_point_seconds: float = 0.0
    avg_distractions_per_session: float = 0.0
    distraction_sessions_count: int = 0
    post_distraction_completion_rate: float = 0.0
    avg_post_distraction_focus_seconds: float = 0.0
    goal_completion_rate: float = 0.0
    prediction_accuracy: float = 0.0
    predictions_count: int = 0
    consistency_score: float = 0.0
    daily_consistency_score: float = 0.0
    weekly_consistency_score: float = 0.0
    goal_units_ratio: float = 1.0
    goal_unit_sessions_count: int = 0
    last_session_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=now)


class Prediction(BaseModel):
    predicted_units: Optional[int] = None
    predicted_distraction_point_seconds: Optional[int] = None
    predicted_focus_seconds: Optional[int] = None
    predicted_completion_probability: float
    confidence: float
    is_first_session: bool
    has_enough_data: bool
    reasoning: List[str]


class SessionCreate(BaseModel):
    user_id: str
    subject_id: str
    topic: Optional[str] = None
    goal: str
    planned_duration_minutes: int = Field(ge=1, le=600)


class SessionEvent(BaseModel):
    kind: Literal["distraction", "break_start", "break_end", "unit_progress", "background", "foreground"]
    at_seconds: int
    payload: Optional[Dict[str, Any]] = None


class SessionEnd(BaseModel):
    ended_early: bool
    units_done: Optional[int] = None
    active_seconds: int
    elapsed_seconds: Optional[int] = None
    events: List[SessionEvent] = []


class VoiceRequest(BaseModel):
    context: Literal[
        "greeting", "pre_session", "mid_session_encourage", "distraction_help",
        "session_end", "evolution", "analytics", "generic",
    ]
    facts: Dict[str, Any]
    tone: Literal["warm", "playful", "focused", "celebrating", "worried"] = "warm"
    max_sentences: int = 2


class TwinChatRequest(BaseModel):
    user_id: str
    question: str = Field(min_length=2, max_length=500)
    history: List[Dict[str, str]] = []


class AssignmentDoubtRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    material_id: Optional[str] = None
    history: List[Dict[str, str]] = []


class HighlightToggle(BaseModel):
    material_id: str
    text: str = Field(min_length=2, max_length=5000)


class RegisterRequest(BaseModel):
    role: Literal["student", "parent", "child"]
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    invite_code: Optional[str] = Field(default=None, max_length=32)


class LoginRequest(BaseModel):
    role: Literal["student", "parent", "child"]
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LinkDecision(BaseModel):
    approved: bool


class AssignmentCreate(BaseModel):
    child_id: str
    title: str = Field(min_length=2, max_length=120)
    subject: str = Field(min_length=2, max_length=80)
    topic: Optional[str] = Field(default=None, max_length=120)
    parent_note: Optional[str] = Field(default=None, max_length=1000)
    scheduled_start: Optional[datetime] = None
    due_at: Optional[datetime] = None
    planned_duration_minutes: int = Field(ge=5, le=600)
    recurrence: Literal["none", "daily", "weekdays", "weekly"] = "none"
    material_ids: List[str] = []
    quiz_required: bool = True


class StudyProgress(BaseModel):
    active_seconds: int = Field(ge=0)
    material_progress: float = Field(ge=0, le=1)
    background_events: int = Field(default=0, ge=0)
    student_marked_done: bool = False


class QuizSubmit(BaseModel):
    answers: List[int]
    background_events: int = Field(default=0, ge=0)


class ManualQuizQuestion(BaseModel):
    prompt: str = Field(min_length=5, max_length=1000)
    choices: List[str]
    answer: int = Field(ge=0, le=3)
    explanation: Optional[str] = Field(default=None, max_length=2000)
    concept: Optional[str] = Field(default=None, max_length=120)


class ManualQuizCreate(BaseModel):
    questions: List[ManualQuizQuestion] = Field(min_length=3, max_length=50)


# ---------------------------------------------------------------------------
# Repositories (light MongoDB access with _id excluded everywhere)
# ---------------------------------------------------------------------------
PROJECT_NO_ID = {"_id": 0}


async def find_one(col: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not mongo_available:
        if ALLOW_MEMORY_DB:
            return await memory_db[col].find_one(query, PROJECT_NO_ID)
        raise HTTPException(503, "MongoDB is unavailable; persistent storage is required")
    try:
        return await db[col].find_one(query, PROJECT_NO_ID)
    except Exception as exc:
        if ALLOW_MEMORY_DB:
            return await memory_db[col].find_one(query, PROJECT_NO_ID)
        raise HTTPException(503, "MongoDB is temporarily unavailable") from exc


async def find_many(col: str, query: Dict[str, Any], sort: Optional[List] = None, limit: int = 200) -> List[Dict[str, Any]]:
    if not mongo_available:
        if not ALLOW_MEMORY_DB:
            raise HTTPException(503, "MongoDB is unavailable; persistent storage is required")
        cursor = memory_db[col].find(query, PROJECT_NO_ID)
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(limit)
    try:
        cursor = db[col].find(query, PROJECT_NO_ID)
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(limit)
    except Exception as exc:
        if not ALLOW_MEMORY_DB:
            raise HTTPException(503, "MongoDB is temporarily unavailable") from exc
        cursor = memory_db[col].find(query, PROJECT_NO_ID)
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(limit)


async def insert(col: str, doc: Dict[str, Any]) -> None:
    if not mongo_available:
        if not ALLOW_MEMORY_DB:
            raise HTTPException(503, "MongoDB is unavailable; persistent storage is required")
        await memory_db[col].insert_one(dict(doc))
        return
    try:
        # Copy so Mongo's mutation of the input dict (adding _id) never leaks.
        await db[col].insert_one(dict(doc))
    except Exception as exc:
        if not ALLOW_MEMORY_DB:
            raise HTTPException(503, "MongoDB is temporarily unavailable") from exc
        await memory_db[col].insert_one(dict(doc))


async def upsert(col: str, query: Dict[str, Any], doc: Dict[str, Any]) -> None:
    if not mongo_available:
        if not ALLOW_MEMORY_DB:
            raise HTTPException(503, "MongoDB is unavailable; persistent storage is required")
        await memory_db[col].update_one(query, {"$set": doc}, upsert=True)
        return
    try:
        await db[col].update_one(query, {"$set": doc}, upsert=True)
    except Exception as exc:
        if not ALLOW_MEMORY_DB:
            raise HTTPException(503, "MongoDB is temporarily unavailable") from exc
        await memory_db[col].update_one(query, {"$set": doc}, upsert=True)


# ---------------------------------------------------------------------------
# Authentication and supervised-family ownership
# ---------------------------------------------------------------------------
def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(422, "Please enter a valid email address")
    return email


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def password_matches(password: str, encoded: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), encoded.encode("utf-8"))
    except Exception:
        return False


def make_access_token(account: Dict[str, Any]) -> str:
    issued = now()
    return jwt.encode(
        {"sub": account["id"], "role": account["role"], "iat": issued, "exp": issued + timedelta(days=TOKEN_DAYS)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


async def current_account(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        account = await find_one("accounts", {"id": payload["sub"]})
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired session") from exc
    if not account or account.get("disabled"):
        raise HTTPException(401, "Account is unavailable")
    return account


def require_account_role(account: Dict[str, Any], *roles: str) -> None:
    if account.get("role") not in roles:
        raise HTTPException(403, "This account cannot perform that action")


async def authorize_user(account: Dict[str, Any], user_id: str) -> None:
    if account["id"] == user_id:
        return
    if account["role"] == "parent" and await find_one("family_links", {"parent_id": account["id"], "child_id": user_id, "status": "approved"}):
        return
    raise HTTPException(403, "You cannot access another learner's data")


async def active_invite_for_parent(parent_id: str) -> Dict[str, Any]:
    existing = await find_one("invite_codes", {"parent_id": parent_id, "used_at": None})
    if existing:
        try:
            if datetime.fromisoformat(existing["expires_at"]) > now():
                return existing
        except Exception:
            pass
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "TWIN-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not await find_one("invite_codes", {"code": code}):
            break
    invite = {
        "id": new_id(), "code": code, "parent_id": parent_id,
        "expires_at": iso(now() + timedelta(hours=24)), "used_at": None, "created_at": iso(now()),
    }
    await insert("invite_codes", invite)
    return invite


async def public_account(account: Dict[str, Any]) -> Dict[str, Any]:
    result = {
        "id": account["id"], "role": account["role"], "name": account["name"],
        "email": account["email"], "created_at": account["created_at"],
    }
    if account["role"] == "parent":
        invite = await active_invite_for_parent(account["id"])
        result["inviteCode"] = invite["code"]
        result["inviteExpiresAt"] = invite["expires_at"]
    elif account["role"] == "child":
        link = await find_one("family_links", {"child_id": account["id"], "status": "approved"})
        if not link:
            link = await find_one("family_links", {"child_id": account["id"], "status": "pending"})
        result["linkStatus"] = link.get("status") if link else "unlinked"
    return result


# ---------------------------------------------------------------------------
# Twin algorithm
# ---------------------------------------------------------------------------
async def get_or_create_profile(user_id: str, subject_id: str) -> Dict[str, Any]:
    existing = await find_one("twin_profiles", {"user_id": user_id, "subject_id": subject_id})
    if existing:
        defaults = TwinProfile(user_id=user_id, subject_id=subject_id).model_dump()
        defaults["last_session_at"] = None
        defaults["updated_at"] = iso(now())
        missing = {key: value for key, value in defaults.items() if key not in existing}
        if missing:
            await upsert("twin_profiles", {"user_id": user_id, "subject_id": subject_id}, missing)
        return {**defaults, **existing}
    profile = TwinProfile(user_id=user_id, subject_id=subject_id).model_dump()
    profile["last_session_at"] = None
    profile["updated_at"] = iso(now())
    await insert("twin_profiles", profile)
    return profile


def predict_from_profile(profile: Dict[str, Any], planned_duration_seconds: int, goal_units: Optional[int]) -> Prediction:
    """Given a subject profile + a planned session, produce a structured prediction.

    Deterministic and interpretable — no LLM here. The LLM only phrases it later.
    """
    sessions_count = profile.get("sessions_count", 0) or 0
    reasoning: List[str] = []

    if sessions_count < 2:
        is_first = sessions_count == 0
        # First session baselines.
        pred_distraction = None
        pred_focus = None
        pred_units = None
        completion_prob = 0.0
        confidence = 0.0
        reasoning.append("First session for this subject — using a gentle baseline.")
        reasoning = [f"Calibration only: {2 - sessions_count} more completed session(s) needed before predicting this subject."]
    else:
        is_first = False
        avg_dist = float(profile.get("avg_distraction_point_seconds") or 0.0)
        avg_focus = float(profile.get("avg_focus_seconds") or 0.0)
        ratio = float(profile.get("goal_units_ratio") or 1.0)
        pred_distraction = int(avg_dist) if avg_dist > 0 else None
        pred_focus = int(min(avg_focus, planned_duration_seconds)) if avg_focus > 0 else None
        has_unit_history = int(profile.get("goal_unit_sessions_count", 0) or 0) > 0
        pred_units = None if goal_units is None or not has_unit_history else max(1, int(round(goal_units * clamp(ratio, 0.3, 1.4))))
        completion_prob = clamp(float(profile.get("goal_completion_rate", 0.0) or 0.0), 0.0, 1.0)
        accuracy_factor = float(profile.get("prediction_accuracy", 0.0) or 0.0) if profile.get("predictions_count", 0) else 0.5
        confidence = clamp(min(sessions_count / 10.0, 1.0) * accuracy_factor, 0.1, 0.95)
        reasoning.append(f"Based on {sessions_count} past session(s) for this subject.")
        if pred_units is not None and goal_units is not None:
            reasoning.append(f"You usually complete about {int(ratio * 100)}% of your planned units.")
        if avg_dist > 0:
            reasoning.append(f"You typically drift around minute {pred_distraction // 60}.")

    return Prediction(
        predicted_units=pred_units,
        predicted_distraction_point_seconds=pred_distraction,
        predicted_focus_seconds=pred_focus,
        predicted_completion_probability=round(completion_prob, 3),
        confidence=round(confidence, 3),
        is_first_session=is_first,
        has_enough_data=sessions_count >= 2,
        reasoning=reasoning,
    )


def summarise_session_events(events: List[SessionEvent], ended_at_seconds: Optional[int] = None) -> Dict[str, Any]:
    distractions = [e for e in events if e.kind == "distraction" or e.kind == "background"]
    breaks_started = [e for e in events if e.kind == "break_start"]
    total_break_seconds = 0
    total_background_seconds = 0
    open_break: Optional[int] = None
    open_background: Optional[int] = None
    for e in sorted(events, key=lambda x: x.at_seconds):
        if e.kind == "break_start":
            open_break = e.at_seconds
        elif e.kind == "break_end" and open_break is not None:
            total_break_seconds += max(0, e.at_seconds - open_break)
            open_break = None
        elif e.kind == "background" and open_background is None:
            open_background = e.at_seconds
        elif e.kind == "foreground" and open_background is not None:
            total_background_seconds += max(0, e.at_seconds - open_background)
            open_background = None
    if ended_at_seconds is not None:
        if open_break is not None:
            total_break_seconds += max(0, ended_at_seconds - open_break)
        if open_background is not None:
            total_background_seconds += max(0, ended_at_seconds - open_background)
    return {
        "distractions": len(distractions),
        "distraction_points": [e.at_seconds for e in distractions],
        "breaks": len(breaks_started),
        "total_break_seconds": total_break_seconds,
        "total_background_seconds": total_background_seconds,
        "first_distraction_at": distractions[0].at_seconds if distractions else None,
    }


async def compute_consistency(user_id: str, subject_id: str) -> Dict[str, float]:
    """Subject-only consistency over the last 7 and 30 calendar days."""
    since = now() - timedelta(days=30)
    sessions = await find_many(
        "sessions",
        {"user_id": user_id, "subject_id": subject_id, "started_at": {"$gte": iso(since)}},
    )
    days: set = set()
    for s in sessions:
        try:
            d = datetime.fromisoformat(s["started_at"]).date()
            days.add(d.isoformat())
        except Exception:
            pass
    today = now().date()
    weekly_days = sum(1 for value in days if (today - datetime.fromisoformat(value).date()).days < 7)
    return {
        "daily": round(len(days) / 30.0, 3),
        "weekly": round(weekly_days / 7.0, 3),
    }


async def update_profile_after_session(profile: Dict[str, Any], session: Dict[str, Any]) -> Dict[str, Any]:
    n = int(profile.get("sessions_count", 0) or 0)
    new_n = n + 1

    def running_mean(prev: float, val: float) -> float:
        return round(((prev * n) + val) / new_n, 3)

    active = float(session["active_seconds"])
    planned = float(session["planned_duration_seconds"])
    goal_units_target = session.get("goal_units_target")
    units_done = session.get("units_done") or 0
    ratio = 1.0 if not goal_units_target else clamp(units_done / goal_units_target, 0.0, 1.5)
    goal_unit_sessions = int(profile.get("goal_unit_sessions_count", 0) or 0)
    goal_units_ratio = float(profile.get("goal_units_ratio", 1.0) or 1.0)
    if goal_units_target:
        goal_units_ratio = round(((goal_units_ratio * goal_unit_sessions) + ratio) / (goal_unit_sessions + 1), 3)
        goal_unit_sessions += 1

    first_dist = session.get("first_distraction_at")
    prior_distraction_sessions = int(profile.get("distraction_sessions_count", 0) or 0)
    goal_completed_bool = bool(session.get("goal_completed"))
    prediction_snapshot = session.get("prediction_snapshot") or {}
    predicted_units = prediction_snapshot.get("predicted_units")
    predicted_focus = prediction_snapshot.get("predicted_focus_seconds")
    predictions_count = int(profile.get("predictions_count", 0) or 0)
    prediction_accuracy = float(profile.get("prediction_accuracy", 0.0) or 0.0)

    # Prediction accuracy for this session (unit-aware if applicable, else time-aware).
    if predicted_units is not None and goal_units_target:
        acc = 1.0 - min(abs(predicted_units - units_done) / max(goal_units_target, 1), 1.0)
        prediction_accuracy = round(((prediction_accuracy * predictions_count) + clamp(acc, 0.0, 1.0)) / (predictions_count + 1), 3)
        predictions_count += 1
    elif predicted_focus is not None:
        acc = 1.0 - min(abs(float(predicted_focus) - active) / max(planned, 1), 1.0)
        prediction_accuracy = round(((prediction_accuracy * predictions_count) + clamp(acc, 0.0, 1.0)) / (predictions_count + 1), 3)
        predictions_count += 1

    avg_distraction = float(profile.get("avg_distraction_point_seconds", 0.0) or 0.0)
    distraction_sessions = prior_distraction_sessions
    post_distraction_completion = float(profile.get("post_distraction_completion_rate", 0.0) or 0.0)
    post_distraction_focus = float(profile.get("avg_post_distraction_focus_seconds", 0.0) or 0.0)
    if first_dist is not None:
        distraction_sessions += 1
        avg_distraction = round(((avg_distraction * prior_distraction_sessions) + float(first_dist)) / distraction_sessions, 3)
        post_distraction_completion = round(
            ((post_distraction_completion * prior_distraction_sessions) + (1.0 if goal_completed_bool else 0.0)) / distraction_sessions,
            3,
        )
        recovery_seconds = max(0.0, active - float(first_dist))
        post_distraction_focus = round(
            ((post_distraction_focus * prior_distraction_sessions) + recovery_seconds) / distraction_sessions,
            3,
        )

    consistency = await compute_consistency(profile["user_id"], profile["subject_id"])
    updated = {
        "sessions_count": new_n,
        "avg_focus_seconds": running_mean(profile.get("avg_focus_seconds", 0.0) or 0.0, active),
        "avg_duration_seconds": running_mean(profile.get("avg_duration_seconds", 0.0) or 0.0, active),
        "avg_distraction_point_seconds": avg_distraction,
        "avg_distractions_per_session": running_mean(profile.get("avg_distractions_per_session", 0.0) or 0.0, session.get("distractions", 0)),
        "distraction_sessions_count": distraction_sessions,
        "post_distraction_completion_rate": post_distraction_completion,
        "avg_post_distraction_focus_seconds": post_distraction_focus,
        "goal_completion_rate": running_mean(profile.get("goal_completion_rate", 0.0) or 0.0, 1.0 if goal_completed_bool else 0.0),
        "prediction_accuracy": prediction_accuracy,
        "predictions_count": predictions_count,
        "goal_units_ratio": goal_units_ratio,
        "goal_unit_sessions_count": goal_unit_sessions,
        "last_session_at": iso(now()),
        "updated_at": iso(now()),
        "daily_consistency_score": consistency["daily"],
        "weekly_consistency_score": consistency["weekly"],
        "consistency_score": consistency["weekly"],
    }
    await upsert(
        "twin_profiles",
        {"user_id": profile["user_id"], "subject_id": profile["subject_id"]},
        updated,
    )
    merged = {**profile, **updated}
    return merged


# ---------------------------------------------------------------------------
# Robot evolution
# ---------------------------------------------------------------------------
STAGE_THRESHOLDS = [0, 70, 210, 450, 900]
STAGE_DISCIPLINE_DAYS = [0, 7, 21, 45, 90]
DAILY_DISCIPLINE_CAP = 10
QUALIFYING_DAY_SCORE = 7


def stage_for_xp(xp: int, fixed_stage: Optional[int] = None) -> Dict[str, Any]:
    stage = fixed_stage or 1
    if fixed_stage is None:
        for i, threshold in enumerate(STAGE_THRESHOLDS):
            if xp >= threshold:
                stage = i + 1
    stage = int(clamp(stage, 1, 5))
    lower = STAGE_THRESHOLDS[stage - 1]
    upper = STAGE_THRESHOLDS[stage] if stage < 5 else lower + 400
    within = 100 if stage == 5 else int(round(((xp - lower) / max(upper - lower, 1)) * 100))
    return {"stage": stage, "stage_progress": clamp(within, 0, 100), "xp": xp, "next_stage_xp": upper if stage < 5 else None}


def compute_energy_delta(session_summary: Dict[str, Any]) -> int:
    """Discipline evidence contributed by a session, capped per day later.

    +4 completes at least 80% of planned active time
    +3 completes a measurable/time-based goal
    +2 honours the planned duration without extreme overrun
    +1 finishes without abandoning/backgrounding repeatedly
    """
    planned = session_summary["planned_duration_seconds"]
    active = session_summary["active_seconds"]
    ratio = active / max(planned, 1)
    points = 4 if ratio >= 0.8 else 0
    if session_summary.get("goal_completed"):
        points += 3
    if 0.8 <= ratio <= 1.2:
        points += 2
    background = int(session_summary.get("total_background_seconds") or 0)
    if not session_summary.get("ended_early") and background <= max(30, planned * 0.1):
        points += 1
    return int(clamp(points, 0, DAILY_DISCIPLINE_CAP))


async def get_or_create_robot(user_id: str) -> Dict[str, Any]:
    doc = await find_one("robot_state", {"user_id": user_id})
    if doc:
        return await apply_inactivity_decay(doc)
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "xp": 0,
        "streak_days": 0,
        "best_streak": 0,
        "discipline_days": 0,
        "evolution_stage": 1,
        "last_qualified_date": None,
        "last_activity_date": None,
        "last_stage_change_date": now().date().isoformat(),
        "decayed_missed_days": 0,
        "last_energy_decay_date": now().date().isoformat(),
        "updated_at": iso(now()),
    }
    await insert("robot_state", doc)
    return doc


async def commitment_dates_between(user_id: str, start_date: date, end_date: date) -> List[str]:
    account = await find_one("accounts", {"id": user_id})
    if account and account.get("role") == "child":
        assignments = await find_many("assignments", {"child_id": user_id}, limit=1000)
        dates = set()
        for assignment in assignments:
            value = assignment.get("scheduled_start") or assignment.get("due_at")
            if not value:
                continue
            try:
                day = datetime.fromisoformat(value).date()
                if start_date < day < end_date and not assignment.get("study_completed"):
                    dates.add(day.isoformat())
            except Exception:
                pass
        return sorted(dates)
    days = max(0, (end_date - start_date).days - 1)
    return [(start_date + timedelta(days=index)).isoformat() for index in range(1, days + 1)]


async def apply_inactivity_decay(state: Dict[str, Any]) -> Dict[str, Any]:
    """Apply at most one tiny energy loss per missed day, once per calendar day."""
    last_activity = state.get("last_activity_date") or state.get("last_session_date")
    if not last_activity:
        return state
    today = now().date()
    try:
        activity_date = datetime.fromisoformat(last_activity).date()
    except Exception:
        return state
    commitment_days = await commitment_dates_between(state["user_id"], activity_date, today)
    missed_days = max(0, len(commitment_days) - 2)
    previously_decayed = int(state.get("decayed_missed_days", 0) or 0)
    new_missed_days = max(0, missed_days - previously_decayed)
    if new_missed_days == 0:
        return state
    xp = max(0, int(state.get("xp", 0)) - (2 * new_missed_days))
    stage = int(state.get("evolution_stage", stage_for_xp(int(state.get("xp", 0)))["stage"]))
    try:
        last_stage_change = datetime.fromisoformat(state.get("last_stage_change_date") or last_activity).date()
    except Exception:
        last_stage_change = activity_date
    if (today - activity_date).days >= 30 and (today - last_stage_change).days >= 30 and stage > 1:
        stage -= 1
        stage_change = today.isoformat()
    else:
        stage_change = state.get("last_stage_change_date") or today.isoformat()
    updated = {
        "xp": xp,
        "streak_days": 0 if missed_days > 0 else int(state.get("streak_days", 0) or 0),
        "evolution_stage": stage,
        "last_stage_change_date": stage_change,
        "decayed_missed_days": missed_days,
        "last_energy_decay_date": today.isoformat(),
        "updated_at": iso(now()),
    }
    await upsert("robot_state", {"user_id": state["user_id"]}, updated)
    return {**state, **updated}


async def apply_energy_delta(user_id: str, delta: int) -> Dict[str, Any]:
    state = await get_or_create_robot(user_id)
    today = now().date().isoformat()
    ledger = await find_one("discipline_days", {"user_id": user_id, "date": today})
    previous_points = int((ledger or {}).get("points", 0) or 0)
    if delta < 0:
        # Repeated abandoned sessions may drain a little stored energy, but they
        # never erase discipline points already earned earlier in the day.
        awarded = -min(abs(int(delta)), int(state.get("xp", 0) or 0))
        day_points = previous_points
    else:
        awarded = min(max(0, delta), DAILY_DISCIPLINE_CAP - previous_points)
        day_points = previous_points + awarded
    new_xp = max(0, int(state["xp"]) + awarded)
    newly_qualified = previous_points < QUALIFYING_DAY_SCORE <= day_points
    streak = int(state.get("streak_days", 0) or 0)
    discipline_days = int(state.get("discipline_days", 0) or 0)
    last_qualified = state.get("last_qualified_date")
    if newly_qualified:
        discipline_days += 1
        try:
            last_d = datetime.fromisoformat(last_qualified).date() if last_qualified else None
            missed_between = await commitment_dates_between(user_id, last_d, now().date()) if last_d else []
            if last_d and not missed_between:
                streak += 1
            else:
                streak = 1
        except Exception:
            streak = 1
        last_qualified = today
    stage = int(state.get("evolution_stage", 1) or 1)
    stage_change = state.get("last_stage_change_date") or today
    if newly_qualified:
        while stage < 5 and new_xp >= STAGE_THRESHOLDS[stage] and discipline_days >= STAGE_DISCIPLINE_DAYS[stage]:
            stage += 1
            stage_change = today
    await upsert("discipline_days", {"user_id": user_id, "date": today}, {
        "user_id": user_id, "date": today, "points": day_points,
        "qualified": day_points >= QUALIFYING_DAY_SCORE, "updated_at": iso(now()),
    })
    updated = {
        "xp": new_xp,
        "streak_days": streak,
        "best_streak": max(int(state.get("best_streak", 0) or 0), streak),
        "discipline_days": discipline_days,
        "evolution_stage": stage,
        "last_qualified_date": last_qualified,
        "last_activity_date": today,
        "last_stage_change_date": stage_change,
        "decayed_missed_days": 0,
        "last_energy_decay_date": today,
        "updated_at": iso(now()),
    }
    await upsert("robot_state", {"user_id": user_id}, updated)
    return {
        **state, **updated, **stage_for_xp(new_xp, stage),
        "daily_xp": day_points, "daily_xp_cap": DAILY_DISCIPLINE_CAP, "awarded_delta": awarded,
    }


# ---------------------------------------------------------------------------
# Voice — Claude Sonnet 4.5 phrases the twin's structured facts
# ---------------------------------------------------------------------------
async def twin_voice(payload: VoiceRequest) -> str:
    if not ANTHROPIC_API_KEY:
        # Deterministic fallback so the app is never broken.
        return _fallback_voice(payload)
    try:
        system = (
            f"You are {ROBOT_NAME}, Aroha's friendly, calm Digital Twin robot companion for a student. "
            "You will receive JSON facts computed by the Digital Twin's own algorithm. "
            "STRICT RULES: never invent numbers, predictions or behaviour. Only rephrase the given facts. "
            "When has_enough_data is false, explicitly say you are calibrating and do not state any predicted time, units, or usual pattern. "
            "When has_enough_data is true, never say you are still learning or calibrating: state the available prediction and invite the student to beat it. "
            f"Speak in the first person as {ROBOT_NAME}, warm and encouraging, never preachy. For a greeting, introduce yourself naturally as {ROBOT_NAME}. "
            f"Respond in at most {payload.max_sentences} short sentences. No bullet points, no lists, no emojis. "
            "If a fact is missing, keep silent about it — do not guess."
        )
        message = await anthropic_text(system=system, max_tokens=180, temperature=0.3, user=(
            f"CONTEXT: {payload.context}\n"
            f"TONE: {payload.tone}\n"
            f"FACTS JSON: {payload.facts}"
        ))
        return message or _fallback_voice(payload)
    except Exception as exc:  # noqa: BLE001
        log.warning("twin_voice LLM failed, using fallback: %s", exc)
        return _fallback_voice(payload)


def _fallback_voice(payload: VoiceRequest) -> str:
    f = payload.facts
    ctx = payload.context
    if ctx == "greeting":
        return f"Hi, I'm {ROBOT_NAME}. Ready to build another calm streak with me today?"
    if ctx == "pre_session":
        pu = f.get("predicted_units")
        dist = f.get("predicted_distraction_point_minutes")
        subj = f.get("subject_name", "this subject")
        if not f.get("has_enough_data", False):
            observed = int(f.get("previous_subject_sessions") or 0)
            if observed == 0:
                return f"This is my first {subj} session with you, so I won't guess yet. I'll observe and start learning your rhythm."
            return f"I have one {subj} session so far, so I'm still studying your rhythm. After today, I'll be ready to challenge you with my first prediction."
        if pu and dist:
            return f"For {subj}, I predict you'll finish about {pu} and drift near minute {dist}. Let's see if you can beat me."
        if pu:
            return f"For {subj}, I predict you'll finish about {pu} today. Let's see if you can beat me."
        if dist:
            return f"For {subj}, I predict your focus may drift near minute {dist}. Let's see if you can beat that point today."
        focus = f.get("predicted_focus_minutes")
        if focus:
            return f"For {subj}, I predict about {focus} focused minutes today. Let's see if you can beat me."
        probability = f.get("predicted_completion_percent")
        if probability is not None:
            return f"For {subj}, I estimate a {probability}% chance of completing today's goal. Let's prove me cautious and beat it."
        return f"I have enough {subj} history to challenge you now. Let's see if you can beat your usual performance today."
    if ctx == "distraction_help":
        m = f.get("typical_distraction_minute")
        recovery = f.get("usual_recovery_minutes")
        recovery_success = f.get("post_distraction_goal_completion_percent")
        if m and recovery and recovery_success is not None:
            return (
                f"This is close to your usual {f.get('subject_name', 'subject')} dip around minute {m}. "
                f"You normally keep going about {recovery} more minutes after a dip, and still finish the goal {recovery_success}% of the time."
            )
        if m:
            return f"You usually feel this dip around minute {m} in this subject. Let's take one breath and continue together."
        return "This is the first distraction pattern I can record for this subject. Take one breath, and I'll learn what helps you recover."
    if ctx == "mid_session_encourage":
        m = f.get("typical_distraction_minute")
        return f"We're near your usual distraction point around minute {m}. I'm staying with you while we move past it."
    if ctx == "session_end":
        pu = f.get("predicted_units")
        au = f.get("actual_units")
        if pu is not None and au is not None:
            if au >= pu:
                return f"You beat me today — I predicted {pu} and you did {au}. I'll remember this next time."
            return f"I predicted {pu} and you did {au}. Small gap — the next session is where you catch me."
        return "Session recorded. I'm getting a clearer picture of how you study."
    if ctx == "evolution":
        stage = f.get("stage", 1)
        return f"Stage {stage} — I can feel a little more energy from your consistency. Keep the small streaks."
    if f.get("structured_answer"):
        return str(f["structured_answer"])
    return "I'm here with you."


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "aroha", "ok": True, "time": iso(now())}


# --- Authentication and family linking ---------------------------------------
@api.post("/auth/register")
async def register_account(body: RegisterRequest):
    email = normalize_email(body.email)
    if await find_one("accounts", {"email": email}):
        raise HTTPException(409, "An account already exists for this email")
    invite = None
    if body.role == "child":
        code = (body.invite_code or "").strip().upper()
        invite = await find_one("invite_codes", {"code": code, "used_at": None})
        if not invite:
            raise HTTPException(400, "This parent code is invalid or has already been used")
        try:
            if datetime.fromisoformat(invite["expires_at"]) <= now():
                raise HTTPException(400, "This parent code has expired. Ask the parent for a new code")
        except ValueError as exc:
            raise HTTPException(400, "This parent code is invalid") from exc
    account = {
        "id": new_id(), "role": body.role, "name": body.name.strip(), "email": email,
        "password_hash": hash_password(body.password), "disabled": False, "created_at": iso(now()),
    }
    await insert("accounts", account)
    if invite:
        link = {
            "id": new_id(), "parent_id": invite["parent_id"], "child_id": account["id"],
            "status": "pending", "created_at": iso(now()), "decided_at": None,
        }
        await insert("family_links", link)
        await upsert("invite_codes", {"id": invite["id"]}, {"used_at": iso(now()), "child_id": account["id"]})
    return {"access_token": make_access_token(account), "account": await public_account(account)}


@api.post("/auth/login")
async def login_account(body: LoginRequest):
    email = normalize_email(body.email)
    account = await find_one("accounts", {"email": email, "role": body.role})
    if not account or not password_matches(body.password, account.get("password_hash", "")):
        raise HTTPException(401, "Incorrect email or password")
    return {"access_token": make_access_token(account), "account": await public_account(account)}


@api.get("/auth/me")
async def auth_me(account: Dict[str, Any] = Depends(current_account)):
    return await public_account(account)


@api.post("/family/invite/refresh")
async def refresh_invite(account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    active = await find_one("invite_codes", {"parent_id": account["id"], "used_at": None})
    if active:
        await upsert("invite_codes", {"id": active["id"]}, {"used_at": iso(now()), "revoked": True})
    return await active_invite_for_parent(account["id"])


@api.get("/family/children")
async def family_children(account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    links = await find_many("family_links", {"parent_id": account["id"]}, sort=[("created_at", -1)])
    result = []
    for link in links:
        child = await find_one("accounts", {"id": link["child_id"], "role": "child"})
        if child:
            result.append({
                "link_id": link["id"], "status": link["status"], "created_at": link["created_at"],
                "child": {"id": child["id"], "name": child["name"], "email": child["email"]},
            })
    return result


@api.patch("/family/links/{link_id}")
async def decide_family_link(link_id: str, body: LinkDecision, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    link = await find_one("family_links", {"id": link_id, "parent_id": account["id"]})
    if not link:
        raise HTTPException(404, "Linking request not found")
    if link.get("status") == "approved" and not body.approved:
        raise HTTPException(409, "Use the explicit Remove action to unlink an approved child")
    status = "approved" if body.approved else "rejected"
    await upsert("family_links", {"id": link_id}, {"status": status, "decided_at": iso(now())})
    return {"id": link_id, "status": status}


@api.delete("/family/links/{link_id}")
async def remove_family_link(link_id: str, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    link = await find_one("family_links", {"id": link_id, "parent_id": account["id"]})
    if not link:
        raise HTTPException(404, "Family link not found")
    if link.get("status") != "approved":
        raise HTTPException(409, "Only an approved child can be removed")
    await upsert("family_links", {"id": link_id}, {
        "status": "removed", "removed_at": iso(now()), "removed_by": account["id"],
    })
    return {"id": link_id, "status": "removed"}


async def approved_child_link(parent_id: str, child_id: str) -> Dict[str, Any]:
    link = await find_one("family_links", {"parent_id": parent_id, "child_id": child_id, "status": "approved"})
    if not link:
        raise HTTPException(403, "This child is not approved for your account")
    return link


async def owned_assignment(assignment_id: str, account: Dict[str, Any]) -> Dict[str, Any]:
    assignment = await find_one("assignments", {"id": assignment_id})
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    if account["role"] == "parent" and assignment["parent_id"] != account["id"]:
        raise HTTPException(403, "This assignment belongs to another family")
    if account["role"] == "child" and assignment["child_id"] != account["id"]:
        raise HTTPException(403, "This assignment belongs to another learner")
    if account["role"] not in ("parent", "child"):
        raise HTTPException(403, "Supervised account required")
    return assignment


def extract_material_text(material: Dict[str, Any]) -> str:
    if material.get("readable_text_available") is False:
        return ""
    if material.get("note_text"):
        return str(material["note_text"])
    path_value = material.get("stored_path")
    if not path_value or not Path(path_value).exists():
        return ""
    path = Path(path_value)
    try:
        if path.suffix.lower() == ".pdf":
            from pypdf import PdfReader
            return "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)
        if path.suffix.lower() in (".txt", ".md"):
            return path.read_text(encoding="utf-8", errors="ignore")
        if path.suffix.lower() == ".docx":
            from docx import Document
            return "\n".join(paragraph.text for paragraph in Document(str(path)).paragraphs)
    except Exception as exc:
        log.warning("material extraction failed for %s: %s", material.get("id"), exc)
    return ""


def pdf_has_extractable_text(path: Path, max_pages: int = 20) -> bool:
    """Quickly distinguish text PDFs from scans without blocking on every page."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        sample = " ".join((page.extract_text() or "") for page in reader.pages[:max_pages])
        return len(re.sub(r"\s+", "", sample)) >= 80
    except Exception:
        return False


def relevant_material_excerpts(materials: List[Dict[str, Any]], question: str, preferred_material_id: Optional[str] = None) -> List[Dict[str, str]]:
    """Retrieve compact, question-relevant excerpts without asking the LLM to search entire files."""
    ignored = {
        "about", "after", "also", "and", "are", "can", "could", "does", "explain", "for", "from",
        "have", "how", "into", "is", "it", "me", "of", "please", "tell", "that", "the", "their",
        "this", "to", "what", "when", "where", "which", "why", "with", "would", "you",
    }
    terms = {word for word in re.findall(r"[a-z0-9]+", question.lower()) if len(word) > 2 and word not in ignored}
    ranked: List[tuple[int, int, str, str]] = []
    for material in materials:
        if material.get("kind") in ("pyq", "youtube"):
            continue
        text = extract_material_text(material).strip()
        if not text:
            continue
        title = str(material.get("title") or "Study material")
        chunks = [value.strip() for value in re.split(r"(?<=[.!?])\s+|\n{2,}", text) if len(value.strip()) >= 25]
        for position, chunk in enumerate(chunks):
            lowered = chunk.lower()
            overlap = sum(1 for term in terms if term in lowered)
            preferred = 2 if material.get("id") == preferred_material_id else 0
            score = overlap * 5 + preferred
            ranked.append((score, -position, title, chunk[:1400]))
    ranked.sort(reverse=True, key=lambda item: (item[0], item[1]))
    positive = [item for item in ranked if item[0] > 0]
    chosen = (positive or ranked)[:8]
    return [{"title": title, "text": text} for _, _, title, text in chosen]


def grounded_doubt_fallback(question: str, excerpts: List[Dict[str, str]]) -> str:
    """A deterministic, material-only answer for temporary LLM outages."""
    if not excerpts:
        return "I couldn't find readable text in the assigned material for that doubt. Try asking the parent to upload a text-based PDF, DOCX or note."
    terms = {word for word in re.findall(r"[a-z0-9]+", question.lower()) if len(word) > 3}
    matching = [item for item in excerpts if any(term in item["text"].lower() for term in terms)]
    if not matching:
        return "I couldn't verify that answer from the assigned material, so I won't guess. Try asking about a term that appears in the chapter."
    best = matching[0]
    return f"From {best['title']}: {best['text']}"


async def generate_assignment_quiz(assignment: Dict[str, Any], allow_llm: bool = True) -> Dict[str, Any]:
    materials = []
    for material_id in assignment.get("material_ids", []):
        material = await find_one("materials", {"id": material_id, "parent_id": assignment["parent_id"]})
        if material:
            materials.append(material)
    study_text = "\n\n".join(extract_material_text(m) for m in materials if m.get("kind") != "pyq").strip()
    pyq_text = "\n\n".join(extract_material_text(m) for m in materials if m.get("kind") == "pyq").strip()
    if len(study_text) < 100:
        raise HTTPException(422, "The assigned material has no usable text. Upload a text-based PDF/DOCX/TXT or ask the parent to create the quiz")

    parsed = None
    if allow_llm and ANTHROPIC_API_KEY:
      try:
        system = (
            "Generate a grounded assessment using ONLY the supplied study material. "
            "Use the PYQ text only as a blueprint for question style, difficulty and distribution; never copy answers from outside the study material. "
            "Return strict JSON with a questions array. Each question needs prompt, exactly four choices, zero-based answer, explanation, concept and difficulty. "
            "Do not include markdown or any text outside JSON."
        )
        reply = await anthropic_text(system=system, max_tokens=7000, temperature=0, user=(
            f"SUBJECT: {assignment['subject']}\nTOPIC: {assignment.get('topic') or ''}\n"
            f"Create 10 questions.\nSTUDY MATERIAL:\n{study_text[:60000]}\n\nPYQ BLUEPRINT:\n{pyq_text[:25000]}"
        ))
        cleaned = (reply or "").strip().removeprefix("```json").removesuffix("```").strip()
        parsed = json.loads(cleaned)
      except Exception as exc:
        # Billing/network/provider failures must not block the student's study
        # flow. The fallback below remains grounded in the uploaded text.
        log.warning("Claude quiz generation unavailable; using grounded local fallback: %s", exc)

    questions = []
    for item in (parsed or {}).get("questions", []):
        choices = item.get("choices")
        answer = item.get("answer")
        if not isinstance(item.get("prompt"), str) or not isinstance(choices, list) or len(choices) != 4:
            continue
        if not isinstance(answer, int) or answer < 0 or answer > 3:
            continue
        questions.append({
            "prompt": item["prompt"], "choices": [str(c) for c in choices], "answer": answer,
            "explanation": str(item.get("explanation") or ""), "concept": str(item.get("concept") or assignment.get("topic") or assignment["subject"]),
            "difficulty": str(item.get("difficulty") or "medium"),
        })
    if len(questions) < 5:
        questions = build_grounded_fallback_questions(
            study_text, assignment.get("topic") or assignment["subject"], pyq_text,
        )
    if len(questions) < 3:
        raise HTTPException(422, "Not enough readable material to prepare a grounded quiz. The parent can create the quiz manually")
    quiz = {
        "id": new_id(), "assignment_id": assignment["id"], "parent_id": assignment["parent_id"],
        "child_id": assignment["child_id"], "questions": questions, "created_at": iso(now()),
    }
    await insert("quizzes", quiz)
    await upsert("assignments", {"id": assignment["id"]}, {"quiz_id": quiz["id"], "quiz_status": "ready", "updated_at": iso(now())})
    return quiz


def build_grounded_fallback_questions(study_text: str, concept: str, pyq_text: str = "") -> List[Dict[str, Any]]:
    """Build deterministic cloze questions using only words and statements in the upload.

    This is deliberately extractive rather than generative: it cannot introduce
    facts that were not present in the parent's material. PYQs control the target
    paper length when their text contains identifiable questions.
    """
    stop = {
        "about", "after", "again", "against", "because", "before", "being", "between",
        "could", "during", "every", "first", "from", "have", "into", "more", "other",
        "should", "their", "there", "these", "they", "this", "through", "under", "using",
        "very", "what", "when", "where", "which", "while", "with", "would", "that",
    }
    clean = re.sub(r"\s+", " ", study_text).strip()
    sentences = [s.strip(" -\t\r\n") for s in re.split(r"(?<=[.!?])\s+|\n+", clean)]
    candidates = []
    keyword_pool: List[str] = []
    for sentence in sentences:
        words = re.findall(r"[A-Za-z][A-Za-z0-9_-]{4,}", sentence)
        usable = [word for word in words if word.lower() not in stop and not word.isdigit()]
        if 7 <= len(sentence.split()) <= 45 and usable:
            # Prefer the most specific-looking term, deterministically.
            keyword = max(usable, key=lambda word: (len(word), word.lower()))
            candidates.append((sentence, keyword))
        for word in usable:
            if word.lower() not in {existing.lower() for existing in keyword_pool}:
                keyword_pool.append(word)
    pyq_count = len(re.findall(r"(?:^|\n)\s*(?:q(?:uestion)?\s*)?\d+[.)]", pyq_text, flags=re.I))
    target = max(5, min(10, pyq_count or 8))
    questions: List[Dict[str, Any]] = []
    used_sentences = set()
    for sentence, answer_word in candidates:
        normalized = sentence.lower()
        if normalized in used_sentences:
            continue
        distractors = [word for word in keyword_pool if word.lower() != answer_word.lower()]
        # Similar-length terms make the cloze useful; sorting keeps it reproducible.
        distractors.sort(key=lambda word: (abs(len(word) - len(answer_word)), word.lower()))
        chosen = distractors[:3]
        if len(chosen) < 3:
            continue
        choices = [answer_word, *chosen]
        rotation = len(questions) % 4
        choices = choices[rotation:] + choices[:rotation]
        answer_index = choices.index(answer_word)
        blanked = re.sub(rf"\b{re.escape(answer_word)}\b", "_____", sentence, count=1, flags=re.I)
        questions.append({
            "prompt": f"Complete this statement from your assigned material: {blanked}",
            "choices": choices, "answer": answer_index,
            "explanation": sentence, "concept": concept,
            "difficulty": "medium" if pyq_text else "recall",
            "source": "grounded_local",
        })
        used_sentences.add(normalized)
        if len(questions) >= target:
            break
    return questions


# --- Supervised materials and assignments ------------------------------------
@api.post("/supervised/materials")
async def upload_material(
    child_id: str = Form(...),
    title: str = Form(...),
    kind: Literal["pdf", "textbook", "worksheet", "pyq", "note", "youtube"] = Form(...),
    source_url: Optional[str] = Form(default=None),
    note_text: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
    account: Dict[str, Any] = Depends(current_account),
):
    require_account_role(account, "parent")
    await approved_child_link(account["id"], child_id)
    if kind == "youtube" and not (source_url or "").startswith(("https://youtube.com/", "https://www.youtube.com/", "https://youtu.be/")):
        raise HTTPException(422, "Enter a valid YouTube link")
    if kind not in ("youtube", "note") and file is None:
        raise HTTPException(422, "Please select a file")
    stored_path = None
    original_name = None
    size_bytes = 0
    if file is not None:
        content = await file.read(30 * 1024 * 1024 + 1)
        if len(content) > 30 * 1024 * 1024:
            raise HTTPException(413, "Material must be 30 MB or smaller")
        suffix = Path(file.filename or "material").suffix.lower()
        if suffix not in (".pdf", ".txt", ".md", ".docx"):
            raise HTTPException(422, "Supported files are PDF, TXT, Markdown and DOCX")
        upload_dir = ROOT_DIR / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        destination = upload_dir / f"{new_id()}{suffix}"
        destination.write_bytes(content)
        stored_path, original_name, size_bytes = str(destination), file.filename, len(content)
    readable_text_available = None
    if stored_path and Path(stored_path).suffix.lower() == ".pdf":
        readable_text_available = pdf_has_extractable_text(Path(stored_path))
    material = {
        "id": new_id(), "parent_id": account["id"], "child_id": child_id,
        "title": title.strip(), "kind": kind, "source_url": source_url,
        "note_text": note_text, "stored_path": stored_path, "original_name": original_name,
        "size_bytes": size_bytes, "readable_text_available": readable_text_available,
        "processing_warning": "This is a scanned PDF. It is saved, but automatic quiz generation needs OCR or a parent-created quiz." if readable_text_available is False else None,
        "created_at": iso(now()),
    }
    await insert("materials", material)
    return {k: v for k, v in material.items() if k != "stored_path"}


@api.get("/supervised/materials")
async def list_materials(child_id: str, account: Dict[str, Any] = Depends(current_account)):
    if account["role"] == "parent":
        await approved_child_link(account["id"], child_id)
        query = {"parent_id": account["id"], "child_id": child_id}
    elif account["role"] == "child" and account["id"] == child_id:
        query = {"child_id": child_id}
    else:
        raise HTTPException(403, "Materials belong to another learner")
    rows = await find_many("materials", query, sort=[("created_at", -1)])
    return [{k: v for k, v in row.items() if k != "stored_path"} for row in rows]


@api.get("/supervised/materials/{material_id}/file")
async def material_file(material_id: str, account: Dict[str, Any] = Depends(current_account)):
    material = await find_one("materials", {"id": material_id})
    if not material:
        raise HTTPException(404, "Material not found")
    if account["role"] == "parent" and material["parent_id"] != account["id"]:
        raise HTTPException(403, "Material belongs to another family")
    if account["role"] == "child":
        if material["child_id"] != account["id"]:
            raise HTTPException(403, "Material belongs to another learner")
        active_attempt = await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"})
        if active_attempt:
            raise HTTPException(423, "Study material is locked during assessment mode")
    path = material.get("stored_path")
    if not path or not Path(path).exists():
        raise HTTPException(404, "No file is attached to this material")
    return FileResponse(path, filename=material.get("original_name") or Path(path).name)


@api.get("/supervised/materials/{material_id}/content")
async def material_content(material_id: str, account: Dict[str, Any] = Depends(current_account)):
    """Return readable material text for Expo Go, where Android WebView cannot render PDFs."""
    material = await find_one("materials", {"id": material_id})
    if not material:
        raise HTTPException(404, "Material not found")
    if account["role"] == "parent" and material["parent_id"] != account["id"]:
        raise HTTPException(403, "Material belongs to another family")
    if account["role"] == "child":
        if material["child_id"] != account["id"]:
            raise HTTPException(403, "Material belongs to another learner")
        active_attempt = await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"})
        if active_attempt:
            raise HTTPException(423, "Study material is locked during assessment mode")
    if account["role"] not in ("parent", "child"):
        raise HTTPException(403, "Supervised account required")
    content = extract_material_text(material).strip()
    if not content:
        raise HTTPException(422, "This file has no readable text. It may be a scanned image PDF")
    return {
        "id": material["id"], "title": material["title"], "kind": material["kind"],
        "content": content[:150000], "truncated": len(content) > 150000,
    }


@api.get("/supervised/assessment/active")
async def active_assessment(account: Dict[str, Any] = Depends(current_account)):
    """Allow a child who reopened the app to resume the locked assessment instead of seeing blank material."""
    require_account_role(account, "child")
    attempt = await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"})
    if not attempt:
        return {"active": False, "assignment_id": None, "attempt_id": None}
    return {"active": True, "assignment_id": attempt["assignment_id"], "attempt_id": attempt["id"]}


@api.get("/supervised/assignments/{assignment_id}/highlights")
async def list_assignment_highlights(assignment_id: str, account: Dict[str, Any] = Depends(current_account)):
    assignment = await owned_assignment(assignment_id, account)
    if account["role"] == "child" and await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"}):
        raise HTTPException(423, "Revision notes are locked during assessment mode")
    rows = await find_many("material_highlights", {
        "assignment_id": assignment_id, "child_id": assignment["child_id"], "active": True,
    }, sort=[("created_at", 1)], limit=500)
    return rows


@api.post("/supervised/assignments/{assignment_id}/highlights/toggle")
async def toggle_assignment_highlight(assignment_id: str, body: HighlightToggle, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "child")
    assignment = await owned_assignment(assignment_id, account)
    if body.material_id not in assignment.get("material_ids", []):
        raise HTTPException(400, "This material is not attached to the assignment")
    material = await find_one("materials", {"id": body.material_id, "child_id": account["id"]})
    if not material:
        raise HTTPException(404, "Study material not found")
    text = re.sub(r"\s+", " ", body.text).strip()
    existing = await find_one("material_highlights", {
        "assignment_id": assignment_id, "material_id": body.material_id,
        "child_id": account["id"], "text": text,
    })
    active = not bool(existing and existing.get("active"))
    if existing:
        await upsert("material_highlights", {"id": existing["id"]}, {"active": active, "updated_at": iso(now())})
        highlight_id = existing["id"]
    else:
        highlight_id = new_id()
        await insert("material_highlights", {
            "id": highlight_id, "assignment_id": assignment_id, "material_id": body.material_id,
            "material_title": material["title"], "child_id": account["id"], "parent_id": assignment["parent_id"],
            "text": text, "active": True, "created_at": iso(now()), "updated_at": iso(now()),
        })
    return {"id": highlight_id, "material_id": body.material_id, "material_title": material["title"], "text": text, "active": active}


@api.post("/supervised/assignments/{assignment_id}/doubt")
async def assignment_doubt(assignment_id: str, body: AssignmentDoubtRequest, account: Dict[str, Any] = Depends(current_account)):
    """Answer a child's study-phase doubt using only readable text from the assigned material."""
    require_account_role(account, "child")
    assignment = await owned_assignment(assignment_id, account)
    active_attempt = await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"})
    if active_attempt:
        raise HTTPException(423, "Doubt chat is locked during assessment mode")
    if assignment.get("study_completed") or assignment.get("quiz_unlocked"):
        raise HTTPException(423, "Doubt chat closes when the reading phase is completed")
    materials = []
    for material_id in assignment.get("material_ids", []):
        material = await find_one("materials", {"id": material_id, "child_id": account["id"]})
        if material:
            materials.append(material)
    excerpts = relevant_material_excerpts(materials, body.question, body.material_id)
    fallback = grounded_doubt_fallback(body.question, excerpts)
    if not ANTHROPIC_API_KEY:
        return {"message": fallback, "grounded": True, "sources": sorted({item["title"] for item in excerpts})}
    history = [
        {"role": "student" if item.get("from") == "me" else "assistant", "text": str(item.get("text", ""))[:1000]}
        for item in body.history[-8:] if item.get("text")
    ]
    context = "\n\n".join(f"SOURCE: {item['title']}\n{item['text']}" for item in excerpts)
    try:
        message = await anthropic_text(
            system=(
                f"You are {ROBOT_NAME}, Aroha's in-session study companion. Answer the student's doubt using ONLY the supplied assigned-material excerpts. "
                "Explain clearly at the student's level and stay concise. You may connect ideas within the excerpts, but never add an unsupported fact. "
                "If the excerpts do not contain the answer, say that honestly and suggest which term in the material to review. "
                "Do not discuss quiz answers, predictions, XP, or behavioural analysis. Do not use markdown tables."
            ),
            max_tokens=500,
            temperature=0.2,
            user=(
                f"ASSIGNMENT: {assignment['subject']} - {assignment.get('topic') or assignment['title']}\n"
                f"RECENT CHAT: {json.dumps(history, ensure_ascii=False)}\n"
                f"STUDENT DOUBT: {body.question}\n\nASSIGNED MATERIAL EXCERPTS:\n{context or '[No readable excerpt found]'}"
            ),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("assignment doubt LLM failed, using grounded fallback: %s", exc)
        message = fallback
    return {"message": message or fallback, "grounded": True, "sources": sorted({item["title"] for item in excerpts})}


def render_highlight_pdf(path: Path, metadata: Dict[str, Any], highlights: List[Dict[str, Any]]) -> None:
    """Render a polished, printable A4 revision document."""
    from html import escape
    from reportlab.lib import colors as pdf_colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    path.parent.mkdir(parents=True, exist_ok=True)
    palette = {
        "ink": pdf_colors.HexColor("#29251F"), "muted": pdf_colors.HexColor("#6E675F"),
        "sage": pdf_colors.HexColor("#9CAF88"), "sage_soft": pdf_colors.HexColor("#E8EFE1"),
        "orange": pdf_colors.HexColor("#F4A261"), "yellow": pdf_colors.HexColor("#FFF3C7"),
        "paper": pdf_colors.HexColor("#FFFCF7"), "line": pdf_colors.HexColor("#E8E0D6"),
    }
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("ArohaTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=palette["ink"], alignment=TA_CENTER, spaceAfter=4)
    subtitle_style = ParagraphStyle("ArohaSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=palette["muted"], alignment=TA_CENTER)
    section_style = ParagraphStyle("ArohaSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=palette["ink"], spaceBefore=12, spaceAfter=8)
    material_style = ParagraphStyle("ArohaMaterial", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=palette["orange"], spaceAfter=6)
    body_style = ParagraphStyle("ArohaBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=16, textColor=palette["ink"])
    label_style = ParagraphStyle("ArohaLabel", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=palette["muted"], uppercase=True)

    def decorate_page(canvas, doc):
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(palette["sage"]); canvas.roundRect(18 * mm, height - 17 * mm, 7 * mm, 7 * mm, 2 * mm, fill=1, stroke=0)
        canvas.setFillColor(palette["orange"]); canvas.circle(21.5 * mm, height - 13.5 * mm, 1.3 * mm, fill=1, stroke=0)
        canvas.setFont("Helvetica-Bold", 8); canvas.setFillColor(palette["muted"]); canvas.drawString(28 * mm, height - 14.8 * mm, "AROHA DIGITAL TWIN")
        canvas.setStrokeColor(palette["line"]); canvas.line(18 * mm, 15 * mm, width - 18 * mm, 15 * mm)
        canvas.setFont("Helvetica", 8); canvas.setFillColor(palette["muted"]); canvas.drawString(18 * mm, 9.5 * mm, "Personal revision notes from verified highlights")
        canvas.drawRightString(width - 18 * mm, 9.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=24 * mm, bottomMargin=21 * mm, title=f"{metadata['topic']} - Aroha Revision Notes", author="Aroha Digital Twin")
    story = [Spacer(1, 7 * mm), Paragraph("Aroha Revision Notes", title_style), Paragraph(f"{escape(str(metadata['subject']))} - {escape(str(metadata['topic']))}", subtitle_style), Spacer(1, 7 * mm)]
    overview = [
        [Paragraph("STUDENT", label_style), Paragraph("GENERATED", label_style), Paragraph("HIGHLIGHTS", label_style)],
        [Paragraph(escape(str(metadata["student"])), body_style), Paragraph(escape(str(metadata["date"])), body_style), Paragraph(str(len(highlights)), body_style)],
    ]
    overview_table = Table(overview, colWidths=[58 * mm, 58 * mm, 42 * mm], hAlign="CENTER")
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), palette["sage_soft"]), ("BOX", (0, 0), (-1, -1), 0.7, palette["line"]),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, palette["line"]), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 7), ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("TOPPADDING", (0, 1), (-1, 1), 5), ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.extend([overview_table, Spacer(1, 5 * mm), Paragraph("Key highlights", section_style)])
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for item in highlights:
        grouped.setdefault(item.get("material_title") or "Study material", []).append(item)
    number = 1
    for material_title, items in grouped.items():
        story.append(Paragraph(escape(str(material_title)), material_style))
        for item in items:
            highlight_body = Table([[Paragraph(str(number), ParagraphStyle("Number", parent=body_style, fontName="Helvetica-Bold", textColor=palette["orange"], alignment=TA_CENTER)), Paragraph(escape(str(item["text"])), body_style)]], colWidths=[11 * mm, 147 * mm])
            highlight_body.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), palette["paper"]), ("BACKGROUND", (0, 0), (0, 0), palette["yellow"]),
                ("BOX", (0, 0), (-1, -1), 0.7, palette["line"]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]))
            story.extend([KeepTogether([highlight_body, Spacer(1, 3 * mm)])])
            number += 1
    story.extend([Spacer(1, 4 * mm), Table([[Paragraph("NEXT REVIEW", label_style), Paragraph("Cover these highlights once from memory, then check the original material only for anything you missed.", body_style)]], colWidths=[32 * mm, 126 * mm], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), palette["sage_soft"]), ("BOX", (0, 0), (-1, -1), 0.7, palette["sage"]), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("PADDING", (0, 0), (-1, -1), 9)]))])
    doc.build(story, onFirstPage=decorate_page, onLaterPages=decorate_page)


async def generate_highlight_pdf(assignment: Dict[str, Any], child: Dict[str, Any]) -> Optional[Path]:
    highlights = await find_many("material_highlights", {
        "assignment_id": assignment["id"], "child_id": assignment["child_id"], "active": True,
    }, sort=[("created_at", 1)], limit=500)
    if not highlights:
        return None
    topic = assignment.get("topic") or assignment["title"]
    path = ROOT_DIR / "output" / "pdf" / f"{assignment['id']}-highlights.pdf"
    render_highlight_pdf(path, {
        "student": child.get("name", "Student"), "subject": assignment["subject"],
        "topic": topic, "date": now().astimezone().strftime("%d %B %Y"),
    }, highlights)
    await upsert("assignments", {"id": assignment["id"]}, {
        "highlight_pdf_path": str(path), "highlight_pdf_generated_at": iso(now()),
        "highlight_count": len(highlights),
    })
    return path


@api.get("/supervised/assignments/{assignment_id}/highlights/pdf")
async def download_assignment_highlights_pdf(assignment_id: str, account: Dict[str, Any] = Depends(current_account)):
    assignment = await owned_assignment(assignment_id, account)
    if account["role"] == "child" and await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"}):
        raise HTTPException(423, "Revision notes are locked during assessment mode")
    child = await find_one("accounts", {"id": assignment["child_id"]})
    path = await generate_highlight_pdf(assignment, child or {"name": "Student"})
    if not path:
        raise HTTPException(404, "Highlight at least one line before creating revision notes")
    safe_topic = re.sub(r"[^A-Za-z0-9_-]+", "-", assignment.get("topic") or assignment["title"]).strip("-") or "revision"
    return FileResponse(str(path), media_type="application/pdf", filename=f"Aroha-{safe_topic}-highlights.pdf")


@api.get("/supervised/revision-notes")
async def list_revision_notes(account: Dict[str, Any] = Depends(current_account)):
    """Return only the logged-in child's saved highlight collections."""
    require_account_role(account, "child")
    if await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"}):
        raise HTTPException(423, "Revision notes are locked until the active assessment is submitted")
    assignments = await find_many(
        "assignments", {"child_id": account["id"]}, sort=[("updated_at", -1)], limit=500,
    )
    all_highlights = await find_many(
        "material_highlights", {"child_id": account["id"], "active": True},
        sort=[("created_at", 1)], limit=5000,
    )
    highlights_by_assignment: Dict[str, List[Dict[str, Any]]] = {}
    for highlight in all_highlights:
        highlights_by_assignment.setdefault(str(highlight.get("assignment_id")), []).append(highlight)
    notes = []
    for assignment in assignments:
        highlights = highlights_by_assignment.get(assignment["id"], [])
        if not highlights:
            continue
        updated_values = [str(item.get("updated_at") or item.get("created_at") or "") for item in highlights]
        notes.append({
            "assignment_id": assignment["id"],
            "title": assignment["title"],
            "subject": assignment["subject"],
            "topic": assignment.get("topic") or assignment["title"],
            "highlight_count": len(highlights),
            "updated_at": max(updated_values) if updated_values else assignment.get("updated_at"),
            "pdf_ready": bool(assignment.get("highlight_pdf_path")),
        })
    notes.sort(key=lambda item: str(item.get("updated_at") or ""), reverse=True)
    return notes


@api.get("/assets/pdfjs/{filename}")
async def pdfjs_asset(filename: str):
    """Serve the bundled PDF.js runtime used by the private in-app viewer."""
    allowed = {"pdf.min.mjs", "pdf.worker.min.mjs"}
    if filename not in allowed:
        raise HTTPException(404, "PDF viewer asset not found")
    path = ROOT_DIR.parent / "frontend" / "node_modules" / "pdfjs-dist" / "build" / filename
    if not path.exists():
        raise HTTPException(503, "PDF viewer dependency is not installed")
    return FileResponse(str(path), media_type="text/javascript")


@api.post("/supervised/assignments")
async def create_assignment(body: AssignmentCreate, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    await approved_child_link(account["id"], body.child_id)
    for material_id in body.material_ids:
        if not await find_one("materials", {"id": material_id, "parent_id": account["id"], "child_id": body.child_id}):
            raise HTTPException(400, "One of the selected materials is unavailable")
    doc = body.model_dump()
    doc.update({
        "id": new_id(), "parent_id": account["id"], "status": "assigned",
        "study_completed": False, "quiz_unlocked": False,
        "quiz_status": "not_requested" if not body.quiz_required else "pending_generation",
        "created_at": iso(now()), "updated_at": iso(now()),
        "scheduled_start": iso(body.scheduled_start) if body.scheduled_start else None,
        "due_at": iso(body.due_at) if body.due_at else None,
    })
    await insert("assignments", doc)
    return doc


@api.get("/supervised/assignments")
async def list_assignments(child_id: Optional[str] = None, account: Dict[str, Any] = Depends(current_account)):
    if account["role"] == "parent":
        query: Dict[str, Any] = {"parent_id": account["id"]}
        if child_id:
            await approved_child_link(account["id"], child_id)
            query["child_id"] = child_id
    elif account["role"] == "child":
        link = await find_one("family_links", {"child_id": account["id"], "status": "approved"})
        if not link:
            return []
        query = {"child_id": account["id"], "parent_id": link["parent_id"]}
    else:
        raise HTTPException(403, "Supervised account required")
    return await find_many("assignments", query, sort=[("scheduled_start", 1), ("created_at", -1)])


@api.get("/supervised/assignments/{assignment_id}")
async def get_supervised_assignment(assignment_id: str, account: Dict[str, Any] = Depends(current_account)):
    return await owned_assignment(assignment_id, account)


@api.post("/supervised/assignments/{assignment_id}/study/start")
async def start_assignment_study(assignment_id: str, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "child")
    assignment = await owned_assignment(assignment_id, account)
    await upsert("assignments", {"id": assignment_id}, {"status": "studying", "study_started_at": iso(now()), "updated_at": iso(now())})
    return {"id": assignment_id, "status": "studying"}


@api.post("/supervised/assignments/{assignment_id}/study/complete")
async def complete_assignment_study(assignment_id: str, body: StudyProgress, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "child")
    assignment = await owned_assignment(assignment_id, account)
    required_seconds = int(assignment["planned_duration_minutes"]) * 60
    # The quiz verifies mastery, so an arbitrary timer must not trap a fast
    # reader who explicitly completed every attached item.
    minimum_early_seconds = 0
    # Supervised assessments unlock only after the parent's full planned time
    # and every assigned study item have been completed. A student may finish
    # early after a meaningful minimum block; quiz mastery then verifies that
    # learning instead of falsely crediting the full planned duration.
    duration_ok = body.active_seconds >= required_seconds
    material_ok = not assignment.get("material_ids") or body.material_progress >= 1.0
    early_completion = bool(
        body.student_marked_done and not duration_ok and material_ok
    )
    completed = material_ok and (duration_ok or early_completion)
    discipline_awarded = bool(assignment.get("discipline_awarded"))
    robot = None
    study_points = int(assignment.get("study_points_awarded", 0) or 0)
    if completed and not discipline_awarded:
        # Supervised evolution: verified study contributes up to 7 points;
        # quiz mastery contributes the remaining 0-3 points on submission.
        points = 3  # all assigned material/instructions completed
        if duration_ok:
            points += 2
        scheduled = assignment.get("scheduled_start")
        started = assignment.get("study_started_at")
        if not scheduled or not started:
            points += 1
        else:
            try:
                if abs((datetime.fromisoformat(started) - datetime.fromisoformat(scheduled)).total_seconds()) <= 3600:
                    points += 1
            except Exception:
                pass
        if body.background_events <= 1:
            points += 1
        robot = await apply_energy_delta(account["id"], points)
        study_points = points
        discipline_awarded = True
    quiz_generation_error = assignment.get("quiz_generation_error") if assignment.get("quiz_status") == "needs_parent_action" else None
    quiz_ready = assignment.get("quiz_status") == "ready"
    if completed and assignment.get("quiz_required") and not quiz_ready and assignment.get("quiz_status") != "needs_parent_action":
        try:
            # Parent-side preparation already tries Claude. At the finish gate,
            # prefer the immediate grounded fallback so the child is not left
            # staring at a provider/network wait.
            quiz = await generate_assignment_quiz(assignment, allow_llm=False)
            assignment["quiz_id"] = quiz["id"]
            assignment["quiz_status"] = "ready"
            quiz_ready = True
        except HTTPException as exc:
            quiz_generation_error = str(exc.detail)
    quiz_unlocked = completed and bool(assignment.get("quiz_required")) and quiz_ready
    update = {
        "active_seconds": body.active_seconds, "material_progress": body.material_progress,
        "background_events": body.background_events, "study_completed": completed,
        "student_marked_done": body.student_marked_done,
        "ended_early": early_completion,
        "quiz_unlocked": quiz_unlocked,
        "status": "quiz_ready" if quiz_unlocked else ("study_complete" if completed and assignment.get("quiz_required") else ("completed" if completed else "studying")),
        "discipline_awarded": discipline_awarded,
        "study_points_awarded": study_points,
        "study_completed_at": iso(now()) if completed else None, "updated_at": iso(now()),
    }
    await upsert("assignments", {"id": assignment_id}, update)
    highlight_pdf_ready = False
    if completed:
        try:
            highlight_pdf_ready = bool(await generate_highlight_pdf({**assignment, **update}, account))
        except Exception as exc:
            # PDF export must never prevent study completion or quiz access.
            log.exception("highlight PDF generation failed for %s: %s", assignment_id, exc)
    return {
        "id": assignment_id, **update, "required_active_seconds": required_seconds,
        "minimum_early_seconds": minimum_early_seconds, "robot": robot,
        "quiz_generation_error": quiz_generation_error, "highlight_pdf_ready": highlight_pdf_ready,
    }


@api.post("/supervised/assignments/{assignment_id}/quiz/generate")
async def generate_quiz(assignment_id: str, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    assignment = await owned_assignment(assignment_id, account)
    if not assignment.get("quiz_required"):
        raise HTTPException(400, "This assignment does not require a quiz")
    existing = await find_one("quizzes", {"assignment_id": assignment_id})
    try:
        quiz = existing or await generate_assignment_quiz(assignment)
    except HTTPException as exc:
        await upsert("assignments", {"id": assignment_id}, {
            "quiz_status": "needs_parent_action", "quiz_generation_error": str(exc.detail), "updated_at": iso(now()),
        })
        raise
    return {"quiz_id": quiz["id"], "questions_count": len(quiz["questions"]), "status": "ready"}


@api.post("/supervised/assignments/{assignment_id}/quiz/manual")
async def create_manual_quiz(assignment_id: str, body: ManualQuizCreate, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    assignment = await owned_assignment(assignment_id, account)
    questions = []
    for item in body.questions:
        if len(item.choices) != 4 or any(not str(choice).strip() for choice in item.choices):
            raise HTTPException(422, "Every parent-created question must have exactly four choices")
        questions.append({
            "prompt": item.prompt.strip(), "choices": [str(choice).strip() for choice in item.choices],
            "answer": item.answer, "explanation": (item.explanation or "Parent-created question").strip(),
            "concept": (item.concept or assignment.get("topic") or assignment["subject"]).strip(),
            "difficulty": "parent_set", "source": "parent",
        })
    existing = await find_one("quizzes", {"assignment_id": assignment_id})
    quiz = {
        "id": existing["id"] if existing else new_id(), "assignment_id": assignment_id,
        "parent_id": account["id"], "child_id": assignment["child_id"],
        "questions": questions, "created_at": existing.get("created_at") if existing else iso(now()),
        "updated_at": iso(now()), "source": "parent",
    }
    if existing:
        await upsert("quizzes", {"id": existing["id"]}, quiz)
    else:
        await insert("quizzes", quiz)
    unlocked = bool(assignment.get("study_completed"))
    await upsert("assignments", {"id": assignment_id}, {
        "quiz_required": True, "quiz_id": quiz["id"], "quiz_status": "ready",
        "quiz_unlocked": unlocked, "status": "quiz_ready" if unlocked else assignment.get("status", "assigned"),
        "updated_at": iso(now()),
    })
    return {"quiz_id": quiz["id"], "questions_count": len(questions), "status": "ready"}


@api.post("/supervised/assignments/{assignment_id}/quiz/begin")
async def begin_quiz(assignment_id: str, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "child")
    assignment = await owned_assignment(assignment_id, account)
    other_attempt = await find_one("quiz_attempts", {"child_id": account["id"], "status": "active"})
    if other_attempt and other_attempt.get("assignment_id") != assignment_id:
        raise HTTPException(409, "Finish the assessment already in progress before starting another one")
    if not assignment.get("study_completed") or not assignment.get("quiz_unlocked"):
        raise HTTPException(423, "Complete the required study phase before beginning the quiz")
    quiz = await find_one("quizzes", {"assignment_id": assignment_id, "child_id": account["id"]})
    if not quiz:
        raise HTTPException(409, "The grounded quiz is not ready yet")
    existing = await find_one("quiz_attempts", {"assignment_id": assignment_id, "child_id": account["id"], "status": "active"})
    attempt = existing or {
        "id": new_id(), "assignment_id": assignment_id, "quiz_id": quiz["id"], "child_id": account["id"],
        "status": "active", "started_at": iso(now()), "background_events": 0,
    }
    if not existing:
        await insert("quiz_attempts", attempt)
    public_questions = [{"prompt": q["prompt"], "choices": q["choices"], "concept": q["concept"]} for q in quiz["questions"]]
    return {"attempt_id": attempt["id"], "assessment_locked": True, "questions": public_questions}


@api.post("/supervised/assignments/{assignment_id}/quiz/submit")
async def submit_quiz(assignment_id: str, body: QuizSubmit, account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "child")
    assignment = await owned_assignment(assignment_id, account)
    attempt = await find_one("quiz_attempts", {"assignment_id": assignment_id, "child_id": account["id"], "status": "active"})
    quiz = await find_one("quizzes", {"id": assignment.get("quiz_id"), "child_id": account["id"]})
    if not attempt or not quiz:
        raise HTTPException(409, "No active assessment was found")
    questions = quiz["questions"]
    if len(body.answers) != len(questions):
        raise HTTPException(422, "Answer every question before submitting")
    correct = sum(1 for index, answer in enumerate(body.answers) if answer == questions[index]["answer"])
    concept_totals: Dict[str, Dict[str, int]] = {}
    for index, question in enumerate(questions):
        concept = question.get("concept") or assignment.get("topic") or assignment["subject"]
        bucket = concept_totals.setdefault(concept, {"correct": 0, "total": 0})
        bucket["total"] += 1
        if body.answers[index] == question["answer"]:
            bucket["correct"] += 1
    result = {
        "status": "completed", "submitted_at": iso(now()), "score": correct,
        "total": len(questions), "score_percent": round(correct / max(len(questions), 1) * 100),
        "background_events": body.background_events, "concepts": concept_totals,
        # Retain the child's selections so the approved parent can see exactly
        # which concepts went wrong. These never go back to an active child quiz.
        "answers": list(body.answers),
    }
    mastery_xp = 3 if result["score_percent"] >= 90 else 2 if result["score_percent"] >= 75 else 1 if result["score_percent"] >= 60 else 0
    mastery_awarded = bool(assignment.get("mastery_awarded"))
    robot = None
    if not mastery_awarded:
        if mastery_xp:
            robot = await apply_energy_delta(account["id"], mastery_xp)
            mastery_xp = int(robot.get("awarded_delta", mastery_xp))
        mastery_awarded = True
    result["mastery_xp"] = mastery_xp
    result["robot"] = robot
    await upsert("quiz_attempts", {"id": attempt["id"]}, result)
    await upsert("assignments", {"id": assignment_id}, {
        "status": "completed", "quiz_completed": True,
        "mastery_awarded": mastery_awarded, "mastery_xp_awarded": mastery_xp,
        "updated_at": iso(now()),
    })
    await insert("concept_mastery", {
        "id": new_id(), "child_id": account["id"], "subject": assignment["subject"],
        "topic": assignment.get("topic"), "assignment_id": assignment_id,
        "concepts": concept_totals, "score_percent": result["score_percent"], "created_at": iso(now()),
    })
    return result


@api.get("/supervised/analytics")
async def supervised_analytics(account: Dict[str, Any] = Depends(current_account)):
    require_account_role(account, "parent")
    links = await find_many("family_links", {"parent_id": account["id"], "status": "approved"})
    child_ids = [link["child_id"] for link in links]
    assignments = await find_many("assignments", {"parent_id": account["id"]}, limit=500)
    attempts = await find_many("quiz_attempts", {"child_id": {"$in": child_ids}, "status": "completed"}, limit=500) if child_ids else []
    mastery = await find_many("concept_mastery", {"child_id": {"$in": child_ids}}, limit=500) if child_ids else []
    planned_minutes = sum(int(item.get("planned_duration_minutes") or 0) for item in assignments)
    actual_minutes = sum(int(item.get("active_seconds") or 0) // 60 for item in assignments)
    completed = sum(1 for item in assignments if item.get("status") == "completed")
    weak: Dict[str, List[float]] = {}
    for row in mastery:
        for concept, values in (row.get("concepts") or {}).items():
            weak.setdefault(concept, []).append(values.get("correct", 0) / max(values.get("total", 1), 1))
    weak_topics = [
        {"concept": concept, "mastery_percent": round(sum(scores) / len(scores) * 100)}
        for concept, scores in weak.items() if sum(scores) / len(scores) < 0.7
    ]
    weak_topics.sort(key=lambda row: row["mastery_percent"])
    attempt_by_assignment = {item["assignment_id"]: item for item in attempts}
    child_names = {}
    for child_id in child_ids:
        child = await find_one("accounts", {"id": child_id, "role": "child"})
        child_names[child_id] = child.get("name", "Student") if child else "Student"
    recent_activity = []
    for item in sorted(assignments, key=lambda row: row.get("updated_at") or row.get("created_at") or "", reverse=True)[:10]:
        attempt = attempt_by_assignment.get(item["id"])
        recent_activity.append({
            "assignment_id": item["id"], "child_id": item["child_id"],
            "child_name": child_names.get(item["child_id"], "Student"),
            "title": item["title"], "subject": item["subject"], "status": item.get("status", "assigned"),
            "planned_minutes": int(item.get("planned_duration_minutes") or 0),
            "actual_minutes": round(int(item.get("active_seconds") or 0) / 60, 1),
            "quiz_percent": attempt.get("score_percent") if attempt else None,
            "updated_at": item.get("updated_at") or item.get("created_at"),
        })
    return {
        "children_count": len(child_ids), "assignments_count": len(assignments), "completed_count": completed,
        "completion_rate": round(completed / len(assignments), 3) if assignments else 0,
        "planned_minutes": planned_minutes, "actual_minutes": actual_minutes,
        "quizzes_completed": len(attempts),
        "average_quiz_percent": round(sum(int(item.get("score_percent") or 0) for item in attempts) / len(attempts)) if attempts else None,
        "weak_topics": weak_topics[:5],
        "recent_activity": recent_activity,
        "observation": (
            "No verified assignments have been completed yet."
            if not completed else
            f"{completed} of {len(assignments)} assigned tasks are complete. Review tomorrow's plan using the weak-topic list."
        ),
    }


@api.get("/supervised/children/{child_id}/report")
async def supervised_child_report(child_id: str, account: Dict[str, Any] = Depends(current_account)):
    """Detailed verified report for one approved child in this family."""
    require_account_role(account, "parent")
    await approved_child_link(account["id"], child_id)
    child = await find_one("accounts", {"id": child_id, "role": "child"})
    if not child:
        raise HTTPException(404, "Linked student account not found")
    assignments = await find_many(
        "assignments", {"parent_id": account["id"], "child_id": child_id},
        sort=[("updated_at", -1)], limit=200,
    )
    attempts = await find_many("quiz_attempts", {"child_id": child_id, "status": "completed"}, limit=200)
    attempt_by_assignment = {item["assignment_id"]: item for item in attempts}
    reports = []
    weak_totals: Dict[str, Dict[str, int]] = {}
    for assignment in assignments:
        attempt = attempt_by_assignment.get(assignment["id"])
        quiz = await find_one("quizzes", {"assignment_id": assignment["id"], "child_id": child_id}) if attempt else None
        mistakes = []
        saved_answers = attempt.get("answers") if attempt else None
        if quiz and isinstance(saved_answers, list):
            for index, question in enumerate(quiz.get("questions", [])):
                selected = saved_answers[index] if index < len(saved_answers) else None
                correct_index = question.get("answer")
                if selected != correct_index:
                    choices = question.get("choices") or []
                    mistakes.append({
                        "question": question.get("prompt", "Question"),
                        "selected": choices[selected] if isinstance(selected, int) and 0 <= selected < len(choices) else "No answer",
                        "correct": choices[correct_index] if isinstance(correct_index, int) and 0 <= correct_index < len(choices) else "Unavailable",
                        "concept": question.get("concept") or assignment.get("topic") or assignment["subject"],
                        "explanation": question.get("explanation") or "",
                    })
        for concept, values in ((attempt or {}).get("concepts") or {}).items():
            bucket = weak_totals.setdefault(concept, {"correct": 0, "total": 0})
            bucket["correct"] += int(values.get("correct") or 0)
            bucket["total"] += int(values.get("total") or 0)
        planned = int(assignment.get("planned_duration_minutes") or 0)
        actual = round(int(assignment.get("active_seconds") or 0) / 60, 1)
        score = attempt.get("score_percent") if attempt else None
        if assignment.get("status") != "completed":
            standing = "in_progress" if assignment.get("study_completed") else "not_started"
        elif score is not None and score >= 75 and actual <= planned:
            standing = "ahead"
        elif score is not None and score < 60:
            standing = "needs_support"
        elif actual > planned * 1.15:
            standing = "needs_support"
        else:
            standing = "on_track"
        reports.append({
            "assignment_id": assignment["id"], "title": assignment["title"],
            "subject": assignment["subject"], "topic": assignment.get("topic"),
            "status": assignment.get("status"), "standing": standing,
            "planned_minutes": planned, "actual_minutes": actual,
            "ended_early": bool(assignment.get("ended_early")),
            "material_progress": round(float(assignment.get("material_progress") or 0) * 100),
            "study_background_events": int(assignment.get("background_events") or 0),
            "study_points": int(assignment.get("study_points_awarded") or 0),
            "quiz": None if not attempt else {
                "score": int(attempt.get("score") or 0), "total": int(attempt.get("total") or 0),
                "score_percent": int(attempt.get("score_percent") or 0),
                "background_events": int(attempt.get("background_events") or 0),
                "mastery_xp": int(attempt.get("mastery_xp") or 0),
                "concepts": attempt.get("concepts") or {}, "mistakes": mistakes,
                "answers_available": isinstance(saved_answers, list),
                "source": (quiz or {}).get("source") or ((quiz or {}).get("questions") or [{}])[0].get("source", "grounded"),
                "submitted_at": attempt.get("submitted_at"),
            },
            "updated_at": assignment.get("updated_at") or assignment.get("created_at"),
        })
    completed = [report for report in reports if report["status"] == "completed"]
    planned_total = sum(report["planned_minutes"] for report in reports)
    actual_total = round(sum(report["actual_minutes"] for report in reports), 1)
    quiz_scores = [report["quiz"]["score_percent"] for report in reports if report["quiz"]]
    weak_topics = [
        {"concept": concept, "mastery_percent": round(values["correct"] / max(values["total"], 1) * 100)}
        for concept, values in weak_totals.items() if values["correct"] / max(values["total"], 1) < 0.7
    ]
    weak_topics.sort(key=lambda row: row["mastery_percent"])
    completion_rate = round(len(completed) / len(reports) * 100) if reports else 0
    average_quiz = round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else None
    if not completed:
        standing = "building"
        robot_summary = f"{ROBOT_NAME}: I'm still learning {child['name']}'s supervised study pattern. A completed task and quiz will give me enough evidence to compare progress."
    elif average_quiz is not None and average_quiz >= 75 and actual_total <= planned_total:
        standing = "ahead"
        robot_summary = f"{ROBOT_NAME}: {child['name']} is ahead overall: study tasks are being completed efficiently with {average_quiz}% average verified mastery."
    elif (average_quiz is not None and average_quiz < 60) or completion_rate < 60:
        standing = "needs_support"
        robot_summary = f"{ROBOT_NAME}: {child['name']} needs some support right now. Completion is {completion_rate}% and verified mastery is {average_quiz if average_quiz is not None else 'still being measured'}%."
    else:
        standing = "on_track"
        robot_summary = f"{ROBOT_NAME}: {child['name']} is on track. I have compared {len(completed)} completed task{'s' if len(completed) != 1 else ''} with the planned time and quiz evidence."
    recommendation = (
        f"Revise {weak_topics[0]['concept']} before the next assignment and use a short follow-up quiz."
        if weak_topics else
        "Keep the next assignment similar in length and difficulty so the Digital Twin can confirm the pattern."
    )
    robot = await get_or_create_robot(child_id)
    return {
        "child": {"id": child["id"], "name": child["name"], "email": child["email"]},
        "summary": {
            "standing": standing, "robot_message": robot_summary, "recommendation": recommendation,
            "assignments": len(reports), "completed": len(completed), "completion_rate": completion_rate,
            "planned_minutes": planned_total, "actual_minutes": actual_total,
            "average_quiz_percent": average_quiz, "weak_topics": weak_topics[:5],
        },
        "robot": {k: robot.get(k) for k in ("xp", "streak_days", "discipline_days", "evolution_stage")},
        "reports": reports,
    }


# --- Subjects -----------------------------------------------------------------
DEFAULT_SUBJECT_COLORS = ["#F4A261", "#9CAF88", "#E9C46A", "#7C9270", "#E78A61"]
DEFAULT_SUBJECT_ICONS = ["book-open", "zap", "trending-up", "droplet", "globe", "cpu"]


@api.post("/subjects", response_model=Subject)
async def create_subject(body: SubjectCreate, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, body.user_id)
    existing = await find_many("subjects", {"user_id": body.user_id})
    color = body.color or DEFAULT_SUBJECT_COLORS[len(existing) % len(DEFAULT_SUBJECT_COLORS)]
    icon = body.icon or DEFAULT_SUBJECT_ICONS[len(existing) % len(DEFAULT_SUBJECT_ICONS)]
    subject = Subject(user_id=body.user_id, name=body.name.strip(), color=color, icon=icon)
    doc = subject.model_dump()
    doc["created_at"] = iso(subject.created_at)
    await insert("subjects", doc)
    # Also seed an empty twin profile so predictions work immediately.
    await get_or_create_profile(body.user_id, subject.id)
    return subject


@api.get("/subjects")
async def list_subjects(user_id: str, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, user_id)
    subjects = await find_many("subjects", {"user_id": user_id}, sort=[("created_at", 1)])
    # Attach profile stats for card previews.
    result = []
    for s in subjects:
        profile = await get_or_create_profile(user_id, s["id"])
        result.append({**s, "profile": profile})
    return result


@api.get("/subjects/{subject_id}")
async def get_subject(subject_id: str, user_id: str, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, user_id)
    subject = await find_one("subjects", {"id": subject_id, "user_id": user_id})
    if not subject:
        raise HTTPException(404, "subject not found")
    profile = await get_or_create_profile(user_id, subject_id)
    recent = await find_many(
        "sessions",
        {"user_id": user_id, "subject_id": subject_id, "ended_at": {"$ne": None}},
        sort=[("ended_at", -1)],
        limit=10,
    )
    return {"subject": subject, "profile": profile, "recent_sessions": recent}


# --- Sessions -----------------------------------------------------------------
@api.post("/sessions/predict")
async def predict_session(body: SessionCreate, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, body.user_id)
    subject = await find_one("subjects", {"id": body.subject_id, "user_id": body.user_id})
    if not subject:
        raise HTTPException(404, "subject not found")
    profile = await get_or_create_profile(body.user_id, body.subject_id)
    units = parse_goal_units(body.goal)
    prediction = predict_from_profile(profile, body.planned_duration_minutes * 60, units)
    return {"prediction": prediction.model_dump(), "profile": profile, "parsed_goal_units": units}


@api.post("/sessions")
async def create_session(body: SessionCreate, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, body.user_id)
    subject = await find_one("subjects", {"id": body.subject_id, "user_id": body.user_id})
    if not subject:
        raise HTTPException(404, "subject not found")
    profile = await get_or_create_profile(body.user_id, body.subject_id)
    units = parse_goal_units(body.goal)
    prediction = predict_from_profile(profile, body.planned_duration_minutes * 60, units)

    session_doc = {
        "id": new_id(),
        "user_id": body.user_id,
        "subject_id": body.subject_id,
        "subject_name": subject["name"],
        "topic": (body.topic or "").strip() or None,
        "goal": body.goal.strip(),
        "goal_units_target": units,
        "planned_duration_minutes": body.planned_duration_minutes,
        "planned_duration_seconds": body.planned_duration_minutes * 60,
        "started_at": iso(now()),
        "ended_at": None,
        "active_seconds": 0,
        "distractions": 0,
        "breaks": 0,
        "first_distraction_at": None,
        "units_done": None,
        "goal_completed": False,
        "ended_early": False,
        "prediction_snapshot": prediction.model_dump(),
        "subject_profile_snapshot": {
            "sessions_count": profile.get("sessions_count", 0),
            "avg_focus_seconds": profile.get("avg_focus_seconds", 0),
            "avg_duration_seconds": profile.get("avg_duration_seconds", 0),
            "avg_distraction_point_seconds": profile.get("avg_distraction_point_seconds", 0),
            "avg_distractions_per_session": profile.get("avg_distractions_per_session", 0),
            "distraction_sessions_count": profile.get("distraction_sessions_count", 0),
            "post_distraction_completion_rate": profile.get("post_distraction_completion_rate", 0),
            "avg_post_distraction_focus_seconds": profile.get("avg_post_distraction_focus_seconds", 0),
            "goal_completion_rate": profile.get("goal_completion_rate", 0),
            "goal_units_ratio": profile.get("goal_units_ratio", 1),
            "goal_unit_sessions_count": profile.get("goal_unit_sessions_count", 0),
            "weekly_consistency_score": profile.get("weekly_consistency_score", profile.get("consistency_score", 0)),
        },
        "events": [],
        "energy_delta": 0,
    }
    await insert("sessions", session_doc)
    return {"session": session_doc}


@api.post("/sessions/{session_id}/end")
async def end_session(session_id: str, body: SessionEnd, account: Dict[str, Any] = Depends(current_account)):
    session = await find_one("sessions", {"id": session_id})
    if not session:
        raise HTTPException(404, "session not found")
    await authorize_user(account, session["user_id"])
    if session.get("ended_at"):
        raise HTTPException(400, "session already ended")

    events_dump = [e.model_dump() for e in body.events]
    planned = int(session["planned_duration_seconds"])
    elapsed = max(0, int(body.elapsed_seconds if body.elapsed_seconds is not None else body.active_seconds))
    summary = summarise_session_events(body.events, elapsed)
    if body.elapsed_seconds is not None:
        active = max(0, elapsed - summary["total_break_seconds"] - summary["total_background_seconds"])
    else:
        # Compatibility for older app clients and existing API consumers.
        active = max(0, int(body.active_seconds))
    units_done = body.units_done
    target = session.get("goal_units_target")
    goal_completed = bool(
        (target is not None and units_done is not None and units_done >= target)
        or (target is None and active >= planned * 0.9)
    )
    ended_early = bool(active < planned * 0.9)

    session_summary = {
        "planned_duration_seconds": planned,
        "active_seconds": active,
        "goal_completed": goal_completed,
        "goal_units_target": target,
        "units_done": units_done,
        "ended_early": ended_early,
        "distractions": summary["distractions"],
        "breaks": summary["breaks"],
        "total_background_seconds": summary["total_background_seconds"],
        "first_distraction_at": summary["first_distraction_at"],
        "prediction_snapshot": session.get("prediction_snapshot") or {},
    }

    energy_delta = compute_energy_delta(session_summary)

    # Persist session updates.
    ended_at = iso(now())
    session_update = {
        "ended_at": ended_at,
        "elapsed_seconds": elapsed,
        "active_seconds": active,
        "units_done": units_done,
        "goal_completed": goal_completed,
        "ended_early": ended_early,
        "distractions": summary["distractions"],
        "distraction_points": summary["distraction_points"],
        "breaks": summary["breaks"],
        "total_break_seconds": summary["total_break_seconds"],
        "total_background_seconds": summary["total_background_seconds"],
        "first_distraction_at": summary["first_distraction_at"],
        "events": events_dump,
        "energy_delta": energy_delta,
    }
    await upsert("sessions", {"id": session_id}, session_update)

    # One difficult session simply earns no energy. Only a repeated pattern of
    # three consecutive early endings causes a small drain, so Reo never
    # punishes an isolated bad day or shrinks suddenly.
    if ended_early:
        recent_sessions = await find_many(
            "sessions",
            {"user_id": session["user_id"], "ended_at": {"$ne": None}},
            sort=[("ended_at", -1)],
            limit=3,
        )
        if len(recent_sessions) == 3 and all(bool(item.get("ended_early")) for item in recent_sessions):
            energy_delta = -2
            session_update["energy_delta"] = energy_delta
            await upsert("sessions", {"id": session_id}, {"energy_delta": energy_delta})

    # Update twin profile.
    profile = await get_or_create_profile(session["user_id"], session["subject_id"])
    profile = await update_profile_after_session(profile, {**session, **session_update, **{"planned_duration_seconds": planned}})

    # Update robot state.
    robot = await apply_energy_delta(session["user_id"], energy_delta)
    energy_delta = int(robot.get("awarded_delta", energy_delta))
    if session_update["energy_delta"] != energy_delta:
        session_update["energy_delta"] = energy_delta
        await upsert("sessions", {"id": session_id}, {"energy_delta": energy_delta})

    # Comparison payload for the end screen.
    prediction = session.get("prediction_snapshot") or {}
    if units_done is not None and prediction.get("predicted_units") is not None:
        beat_prediction = units_done >= prediction["predicted_units"]
    elif prediction.get("predicted_focus_seconds") is not None:
        beat_prediction = active >= int(prediction["predicted_focus_seconds"])
    else:
        beat_prediction = False
    comparison = {
        "predicted_units": prediction.get("predicted_units"),
        "actual_units": units_done,
        "predicted_focus_minutes": (prediction["predicted_focus_seconds"] // 60) if prediction.get("predicted_focus_seconds") is not None else None,
        "actual_focus_minutes": active // 60,
        "predicted_distraction_minute": (prediction["predicted_distraction_point_seconds"] // 60) if prediction.get("predicted_distraction_point_seconds") is not None else None,
        "actual_first_distraction_minute": (summary["first_distraction_at"] // 60) if summary["first_distraction_at"] else None,
        "beat_prediction": bool(beat_prediction),
        "goal_completed": goal_completed,
        "ended_early": ended_early,
        "actual_duration_seconds": active,
        "distractions": summary["distractions"],
        "distraction_points": summary["distraction_points"],
        "breaks": summary["breaks"],
        "energy_delta": energy_delta,
        "robot": robot,
        "stage": stage_for_xp(int(robot["xp"]), int(robot.get("evolution_stage", 1))),
    }

    await upsert("sessions", {"id": session_id}, {"comparison": comparison})

    return {"session": {**session, **session_update}, "profile": profile, "comparison": comparison}


@api.get("/sessions/{session_id}")
async def get_session(session_id: str, user_id: str, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, user_id)
    session = await find_one("sessions", {"id": session_id, "user_id": user_id})
    if not session:
        raise HTTPException(404, "session not found")
    return session


@api.get("/sessions")
async def list_sessions(user_id: str, subject_id: Optional[str] = None, limit: int = 50, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, user_id)
    q: Dict[str, Any] = {"user_id": user_id}
    if subject_id:
        q["subject_id"] = subject_id
    return await find_many("sessions", q, sort=[("started_at", -1)], limit=limit)


# --- Robot --------------------------------------------------------------------
@api.get("/robot/state")
async def robot_state(user_id: str, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, user_id)
    state = await get_or_create_robot(user_id)
    today = now().date().isoformat()
    ledger = await find_one("discipline_days", {"user_id": user_id, "date": today})
    stage = int(state.get("evolution_stage", stage_for_xp(int(state["xp"]))["stage"]))
    try:
        last_activity = datetime.fromisoformat(state.get("last_activity_date")).date() if state.get("last_activity_date") else None
        inactivity_days = (now().date() - last_activity).days if last_activity else 0
    except Exception:
        inactivity_days = 0
    return {
        **state, **stage_for_xp(int(state["xp"]), stage),
        "daily_xp": int((ledger or {}).get("points", 0) or 0),
        "daily_xp_cap": DAILY_DISCIPLINE_CAP,
        "inactivity_days": inactivity_days,
    }


# --- Voice --------------------------------------------------------------------
@api.post("/twin/voice")
async def voice_endpoint(body: VoiceRequest, account: Dict[str, Any] = Depends(current_account)):
    message = await twin_voice(body)
    return {"message": message}


def friendly_chat_fallback(question: str, verified_answer: Optional[str], history: List[Dict[str, str]], student_name: str) -> str:
    """Natural local fallback used only when the conversational service is unavailable."""
    previous_student = next(
        (str(item.get("text", "")) for item in reversed(history) if item.get("from") == "me" and item.get("text")),
        "",
    ).lower()
    if verified_answer:
        if any(word in previous_student for word in ("rough", "hard day", "tired", "stressed", "overwhelmed")):
            return f"I hear you. A difficult day doesn't erase what you've built. {verified_answer}"
        return verified_answer
    lowered = question.lower().strip(" !?.")
    if lowered in ("hi", "hii", "hiii", "hello", "hey"):
        return f"Hey {student_name}, Reo here. How's your day going?"
    if "how are you" in lowered or "how r you" in lowered:
        return "I'm right here with you, and I'm glad you checked in. How are you doing, honestly?"
    if "thank" in lowered:
        return "Always. We’ll figure it out together."
    if any(word in lowered for word in ("tired", "stressed", "sad", "overwhelmed")):
        return "That sounds like a lot right now. Want to tell me what’s making today feel heavy, or should we make the next study step really small?"
    if any(phrase in lowered for phrase in ("can't focus", "cannot focus", "procrastinat", "not able to study", "don't feel like studying")):
        return "Okay, no big speech. Let's choose one tiny thing you can finish in five minutes, then decide what comes next."
    if any(phrase in lowered for phrase in ("i did it", "i finished", "done studying", "goal complete")):
        return "You did it! Take a second to enjoy that; showing up and finishing counts."
    if any(phrase in lowered for phrase in ("can we talk", "listen to me", "need to talk")):
        return "Of course. I'm here and listening. Say it however it comes out."
    if any(word in lowered.split() for word in ("what", "why", "how", "explain")) or question.rstrip().endswith("?"):
        return "I want to answer that properly, but my explanation service isn’t reachable just now. Try once more in a moment—I’d rather be honest than make something up."
    conversational_replies = (
        "I'm with you. Tell me the part that's been on your mind most.",
        "Okay, I'm listening. You don't have to make it sound perfect.",
        "That makes sense. Keep going; I'm following you.",
        "I'm here. Tell me a little more and we'll work through it together.",
    )
    return conversational_replies[len(history) % len(conversational_replies)]


async def natural_reo_chat(
    *, question: str, history: List[Dict[str, str]], verified_answer: Optional[str], evidence: Dict[str, Any], student_name: str,
) -> str:
    """Turn verified Twin facts into a genuine multi-turn conversation."""
    global CHAT_LLM_RETRY_AFTER
    recent_history = [
        {"role": "student" if item.get("from") == "me" else "reo", "text": str(item.get("text", ""))[:1200]}
        for item in history[-10:] if item.get("text")
    ]
    if ANTHROPIC_API_KEY and (CHAT_LLM_RETRY_AFTER is None or now() >= CHAT_LLM_RETRY_AFTER):
        try:
            message = await anthropic_text(
                system=(
                    f"You are {ROBOT_NAME}, Aroha's warm robot study companion. Talk like a thoughtful, supportive friend—not a dashboard, help menu, therapist script, or customer-support bot. "
                    "React directly to what the student just said, remember the recent conversation, use natural contractions, and vary your wording. "
                    "Do not introduce yourself again unless this is the first greeting. Do not list your capabilities, repeat the same invitation, or force every reply to end with a question. "
                    "VERIFIED_BEHAVIOURAL_ANSWER is the only source you may use for personal patterns, scores, predictions, focus, consistency, XP or progress; preserve its numbers and meaning exactly. "
                    "If it is null, do not claim personal behaviour. You may answer ordinary academic questions from general educational knowledge, but never pretend that knowledge came from uploaded material or student history. "
                    "Keep casual replies brief and explanations clear. Usually respond in one to four natural sentences."
                ),
                max_tokens=450,
                temperature=0.55,
                user=(
                    f"STUDENT_NAME: {student_name}\n"
                    f"VERIFIED_BEHAVIOURAL_ANSWER: {json.dumps(verified_answer, ensure_ascii=False)}\n"
                    f"VERIFIED_CONTEXT: {json.dumps(evidence, ensure_ascii=False)}\n"
                    f"RECENT_CONVERSATION: {json.dumps(recent_history, ensure_ascii=False)}\n"
                    f"LATEST_STUDENT_MESSAGE: {question}"
                ),
            )
            if message:
                return message
        except Exception as exc:  # noqa: BLE001
            # Avoid making every chat message wait on a provider that is currently
            # rejecting calls. A backend restart retries immediately after credits
            # or configuration are corrected.
            CHAT_LLM_RETRY_AFTER = now() + timedelta(minutes=15)
            log.warning("natural Reo chat failed, using local fallback: %s", exc)
    return friendly_chat_fallback(question, verified_answer, history, student_name)


@api.post("/twin/chat")
async def twin_chat_endpoint(body: TwinChatRequest, account: Dict[str, Any] = Depends(current_account)):
    """Answer questions about the user's Digital Twin using stored evidence only."""
    await authorize_user(account, body.user_id)
    question = body.question.strip()
    lowered = question.lower()
    sessions = await find_many("sessions", {"user_id": body.user_id, "ended_at": {"$ne": None}}, sort=[("started_at", -1)], limit=500)
    subjects = await find_many("subjects", {"user_id": body.user_id}, limit=100)
    profiles = await find_many("twin_profiles", {"user_id": body.user_id}, limit=100)
    profile_by_subject = {row["subject_id"]: row for row in profiles}
    subject = next((row for row in subjects if row["name"].lower() in lowered), None)
    robot = await get_or_create_robot(body.user_id)
    supervised_assignments = await find_many("assignments", {"child_id": body.user_id}, limit=500) if account.get("role") == "child" else []
    supervised_attempts = await find_many("quiz_attempts", {"child_id": body.user_id, "status": "completed"}, limit=500) if account.get("role") == "child" else []
    completed_supervised = [row for row in supervised_assignments if row.get("status") == "completed"]
    completed_goals = sum(1 for row in sessions if row.get("goal_completed"))
    quiz_scores = [int(row.get("score_percent") or 0) for row in supervised_attempts]
    chat_evidence = {
        "student_name": account.get("name"),
        "completed_sessions": len(sessions),
        "completed_goals": completed_goals,
        "subjects": [row.get("name") for row in subjects],
        "robot_xp": int(robot.get("xp", 0) or 0),
        "robot_stage": int(robot.get("evolution_stage", 1) or 1),
        "assigned_tasks": len(supervised_assignments),
        "completed_assigned_tasks": len(completed_supervised),
        "completed_quizzes": len(supervised_attempts),
        "quiz_average": round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else None,
    }
    greetings = ("hi", "hii", "hiii", "hello", "hey", "good morning", "good evening")
    is_greeting = lowered.strip(" !?.") in greetings
    is_follow_up = any(phrase in lowered for phrase in ("yes tell me", "tell me then", "go on", "okay tell me", "yes please"))

    if is_greeting:
        answer = f"Hi {account.get('name', 'there')}! I'm {ROBOT_NAME}, and I'm ready to look at your study pattern with you. How are you feeling about studying today?"
    elif "how are you" in lowered or "how r you" in lowered:
        answer = f"I'm doing well—I'm {ROBOT_NAME}, currently at {int(robot.get('xp', 0))} XP and stage {int(robot.get('evolution_stage', 1))}. More importantly, how is your focus feeling today?"
    elif is_follow_up:
        if supervised_assignments:
            scores = [int(row.get("score_percent") or 0) for row in supervised_attempts]
            completion = round(len(completed_supervised) / max(len(supervised_assignments), 1) * 100)
            score_text = f" and your quiz average is {round(sum(scores) / len(scores))}%" if scores else ""
            answer = f"Here is what I can verify: you completed {len(completed_supervised)} of {len(supervised_assignments)} assigned tasks ({completion}%){score_text}. Ask me which concept needs attention if you want the next step."
        elif sessions:
            completed = sum(1 for row in sessions if row.get("goal_completed"))
            answer = f"Here is what I can verify: you completed {completed} of {len(sessions)} recorded session goals, and your robot is at stage {int(robot.get('evolution_stage', 1))}. Ask me about focus or a specific subject for more detail."
        else:
            answer = "I don't have a completed study or quiz yet, so there is no honest pattern to report. Once you complete one, I can tell you exactly what happened."
    elif not sessions and not supervised_assignments and any(word in lowered for word in ("pattern", "predict", "history", "behaviour", "behavior")):
        answer = "I don't have completed study sessions yet, so I can't judge your pattern honestly. Complete a subject session and then ask me about focus, consistency, distractions, or goal completion."
    elif any(word in lowered for word in ("streak", "consistent", "consistency", "discipline")):
        if supervised_assignments:
            completion = round(len(completed_supervised) / max(len(supervised_assignments), 1) * 100)
            answer = f"Your current discipline streak is {int(robot.get('streak_days', 0))} days, with {len(completed_supervised)} of {len(supervised_assignments)} assigned tasks completed ({completion}%)."
        else:
            active_dates = {str(row.get("started_at", ""))[:10] for row in sessions if row.get("started_at")}
            answer = f"Your current discipline streak is {int(robot.get('streak_days', 0))} days. I have observed study activity on {len(active_dates)} different days; consistency grows from completed planned sessions, not from opening the app."
    elif any(word in lowered for word in ("distract", "focus", "drift")):
        if supervised_assignments:
            studied = [row for row in supervised_assignments if row.get("study_completed")]
            interruptions = sum(int(row.get("background_events") or 0) for row in studied)
            average = round(interruptions / max(len(studied), 1), 1)
            answer = f"Across {len(studied)} completed study phases, I recorded {interruptions} app interruptions—an average of {average} per task. I only count observable app switches, not guesses about attention."
        else:
            target = subject or max(subjects, key=lambda row: int(profile_by_subject.get(row["id"], {}).get("sessions_count", 0)), default=None)
            profile = profile_by_subject.get(target["id"], {}) if target else {}
            count = int(profile.get("sessions_count", 0) or 0)
            if count < 2:
                answer = f"I need at least two completed {target['name'] if target else 'subject'} sessions before calling a focus point a pattern. I currently have {count}."
            else:
                focus = round(float(profile.get("avg_focus_seconds", 0) or 0) / 60)
                drift = round(float(profile.get("avg_distraction_point_seconds", 0) or 0) / 60)
                answer = f"Across {count} {target['name']} sessions, your average focused time is about {focus} minutes" + (f" and your first distraction tends to appear near minute {drift}." if drift else ". I have not observed a stable distraction point yet.")
    elif any(word in lowered for word in ("goal", "complete", "performance", "doing")):
        if supervised_assignments:
            completed = len(completed_supervised); rate = round(completed / max(len(supervised_assignments), 1) * 100)
            answer = f"You completed {completed} of {len(supervised_assignments)} assigned tasks, a verified completion rate of {rate}%."
        else:
            target = subject
            relevant = [row for row in sessions if not target or row.get("subject_id") == target["id"]]
            completed = sum(1 for row in relevant if row.get("goal_completed"))
            rate = round(completed / max(len(relevant), 1) * 100)
            label = target["name"] if target else "recorded"
            answer = f"You completed {completed} of {len(relevant)} {label} session goals, a verified completion rate of {rate}%."
    elif any(word in lowered for word in ("which subject", "attention", "improve", "weak", "study next")):
        if supervised_attempts:
            concepts: Dict[str, Dict[str, int]] = {}
            for attempt in supervised_attempts:
                for concept, values in (attempt.get("concepts") or {}).items():
                    bucket = concepts.setdefault(concept, {"correct": 0, "total": 0})
                    bucket["correct"] += int(values.get("correct") or 0); bucket["total"] += int(values.get("total") or 0)
            if concepts:
                concept, values = min(concepts.items(), key=lambda item: item[1]["correct"] / max(item[1]["total"], 1))
                rate = round(values["correct"] / max(values["total"], 1) * 100)
                answer = f"{concept} needs the most attention right now because your verified quiz mastery there is {rate}%."
            else:
                answer = "Complete a quiz first so I can identify a weak concept from verified answers."
        else:
            candidates = [(row, profile_by_subject.get(row["id"], {})) for row in subjects if int(profile_by_subject.get(row["id"], {}).get("sessions_count", 0)) > 0]
            if not candidates:
                answer = "I need completed sessions in your subjects before I can compare them honestly."
            else:
                target, profile = min(candidates, key=lambda pair: float(pair[1].get("goal_completion_rate", 0) or 0))
                rate = round(float(profile.get("goal_completion_rate", 0) or 0) * 100)
                answer = f"{target['name']} currently needs the most attention because its verified goal-completion rate is {rate}%, the lowest among subjects I have observed."
    else:
        answer = None

    message = await natural_reo_chat(
        question=question,
        history=body.history,
        verified_answer=answer,
        evidence=chat_evidence,
        student_name=str(account.get("name") or "there"),
    )
    return {"message": message, "grounded": True, "sessions_observed": len(sessions)}


# --- Analytics ----------------------------------------------------------------
@api.get("/analytics/summary")
async def analytics_summary(user_id: str, account: Dict[str, Any] = Depends(current_account)):
    await authorize_user(account, user_id)
    since = now() - timedelta(days=7)
    sessions = await find_many(
        "sessions",
        {"user_id": user_id, "ended_at": {"$ne": None}, "started_at": {"$gte": iso(since)}},
        sort=[("started_at", 1)],
        limit=200,
    )
    total_seconds = sum(int(s.get("active_seconds") or 0) for s in sessions)
    completed = sum(1 for s in sessions if s.get("goal_completed"))
    days: Dict[str, int] = {}
    for s in sessions:
        try:
            d = datetime.fromisoformat(s["started_at"]).date().isoformat()
            days[d] = days.get(d, 0) + int(s.get("active_seconds") or 0)
        except Exception:
            pass
    week = []
    for i in range(6, -1, -1):
        d = (now().date() - timedelta(days=i)).isoformat()
        week.append({"date": d, "seconds": days.get(d, 0)})
    return {
        "total_minutes": total_seconds // 60,
        "sessions_count": len(sessions),
        "completed_count": completed,
        "completion_rate": round(completed / len(sessions), 3) if sessions else 0.0,
        "active_days": len(days),
        "weekly_consistency": round(len(days) / 7.0, 3),
        "week": week,
    }


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    if not mongo_available and not ALLOW_MEMORY_DB:
        raise RuntimeError(
            "MongoDB is required but unavailable. Start MongoDB on port 27017. "
            "Aroha refuses temporary storage because it would lose accounts and family links."
        )
    if mongo_available:
        await client.admin.command("ping")
        await db["accounts"].create_index("email", unique=True)
        await db["invite_codes"].create_index("code", unique=True)
        await db["family_links"].create_index([("parent_id", 1), ("child_id", 1)], unique=True)
        await db["discipline_days"].create_index([("user_id", 1), ("date", 1)], unique=True)


@app.on_event("shutdown")
async def _shutdown() -> None:
    if mongo_available:
        client.close()
