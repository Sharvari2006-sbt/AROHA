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

import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "aroha")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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
    goal_completion_rate: float = 0.0
    prediction_accuracy: float = 0.0
    consistency_score: float = 0.0
    goal_units_ratio: float = 1.0
    last_session_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=now)


class Prediction(BaseModel):
    predicted_units: Optional[int] = None
    predicted_distraction_point_seconds: int
    predicted_focus_seconds: int
    predicted_completion_probability: float
    confidence: float
    is_first_session: bool
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
    events: List[SessionEvent] = []


class VoiceRequest(BaseModel):
    context: Literal[
        "greeting", "pre_session", "mid_session_encourage", "distraction_help",
        "session_end", "evolution", "analytics", "generic",
    ]
    facts: Dict[str, Any]
    tone: Literal["warm", "playful", "focused", "celebrating", "worried"] = "warm"
    max_sentences: int = 2


# ---------------------------------------------------------------------------
# Repositories (light MongoDB access with _id excluded everywhere)
# ---------------------------------------------------------------------------
PROJECT_NO_ID = {"_id": 0}


async def find_one(col: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await db[col].find_one(query, PROJECT_NO_ID)


async def find_many(col: str, query: Dict[str, Any], sort: Optional[List] = None, limit: int = 200) -> List[Dict[str, Any]]:
    cursor = db[col].find(query, PROJECT_NO_ID)
    if sort:
        cursor = cursor.sort(sort)
    return await cursor.to_list(limit)


async def insert(col: str, doc: Dict[str, Any]) -> None:
    # Copy so Mongo's mutation of the input dict (adding _id) never leaks.
    await db[col].insert_one(dict(doc))


async def upsert(col: str, query: Dict[str, Any], doc: Dict[str, Any]) -> None:
    await db[col].update_one(query, {"$set": doc}, upsert=True)


# ---------------------------------------------------------------------------
# Twin algorithm
# ---------------------------------------------------------------------------
async def get_or_create_profile(user_id: str, subject_id: str) -> Dict[str, Any]:
    existing = await find_one("twin_profiles", {"user_id": user_id, "subject_id": subject_id})
    if existing:
        return existing
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

    if sessions_count == 0:
        is_first = True
        # First session baselines.
        pred_distraction = int(planned_duration_seconds * 0.4)
        pred_focus = int(planned_duration_seconds * 0.75)
        pred_units = None if goal_units is None else max(1, int(round(goal_units * 0.8)))
        completion_prob = 0.6
        confidence = 0.2
        reasoning.append("First session for this subject — using a gentle baseline.")
    else:
        is_first = False
        avg_dist = float(profile.get("avg_distraction_point_seconds") or 0.0)
        avg_focus = float(profile.get("avg_focus_seconds") or 0.0)
        ratio = float(profile.get("goal_units_ratio") or 1.0)
        pred_distraction = int(avg_dist if avg_dist > 0 else planned_duration_seconds * 0.4)
        pred_focus = int(min(avg_focus if avg_focus > 0 else planned_duration_seconds * 0.75, planned_duration_seconds))
        pred_units = None if goal_units is None else max(1, int(round(goal_units * clamp(ratio, 0.3, 1.4))))
        completion_prob = clamp(profile.get("goal_completion_rate") or 0.6, 0.15, 0.98)
        confidence = clamp(min(sessions_count / 10.0, 1.0) * clamp(profile.get("prediction_accuracy") or 0.5, 0.2, 1.0), 0.2, 0.95)
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
        reasoning=reasoning,
    )


def summarise_session_events(events: List[SessionEvent]) -> Dict[str, Any]:
    distractions = [e for e in events if e.kind == "distraction" or e.kind == "background"]
    breaks_started = [e for e in events if e.kind == "break_start"]
    total_break_seconds = 0
    open_break: Optional[int] = None
    for e in sorted(events, key=lambda x: x.at_seconds):
        if e.kind == "break_start":
            open_break = e.at_seconds
        elif e.kind == "break_end" and open_break is not None:
            total_break_seconds += max(0, e.at_seconds - open_break)
            open_break = None
    return {
        "distractions": len(distractions),
        "distraction_points": [e.at_seconds for e in distractions],
        "breaks": len(breaks_started),
        "total_break_seconds": total_break_seconds,
        "first_distraction_at": distractions[0].at_seconds if distractions else None,
    }


async def compute_consistency(user_id: str, subject_id: str) -> float:
    """% of the last 7 days on which the student ran at least one session for this subject."""
    since = now() - timedelta(days=7)
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
    return round(len(days) / 7.0, 3)


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

    first_dist = session.get("first_distraction_at") or int(active)
    goal_completed_bool = bool(session.get("goal_completed"))
    predicted_units = (session.get("prediction_snapshot") or {}).get("predicted_units")

    # Prediction accuracy for this session (unit-aware if applicable, else time-aware).
    if predicted_units is not None and goal_units_target:
        acc = 1.0 - min(abs(predicted_units - units_done) / max(goal_units_target, 1), 1.0)
    else:
        pred_focus = (session.get("prediction_snapshot") or {}).get("predicted_focus_seconds") or planned * 0.75
        acc = 1.0 - min(abs(pred_focus - active) / max(planned, 1), 1.0)

    updated = {
        "sessions_count": new_n,
        "avg_focus_seconds": running_mean(profile.get("avg_focus_seconds", 0.0) or 0.0, active),
        "avg_duration_seconds": running_mean(profile.get("avg_duration_seconds", 0.0) or 0.0, planned),
        "avg_distraction_point_seconds": running_mean(profile.get("avg_distraction_point_seconds", 0.0) or 0.0, first_dist),
        "avg_distractions_per_session": running_mean(profile.get("avg_distractions_per_session", 0.0) or 0.0, session.get("distractions", 0)),
        "goal_completion_rate": running_mean(profile.get("goal_completion_rate", 0.0) or 0.0, 1.0 if goal_completed_bool else 0.0),
        "prediction_accuracy": running_mean(profile.get("prediction_accuracy", 0.0) or 0.0, clamp(acc, 0.0, 1.0)),
        "goal_units_ratio": running_mean(profile.get("goal_units_ratio", 1.0) or 1.0, ratio),
        "last_session_at": iso(now()),
        "updated_at": iso(now()),
    }
    updated["consistency_score"] = await compute_consistency(profile["user_id"], profile["subject_id"])
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
STAGE_THRESHOLDS = [0, 100, 250, 500, 800]  # cumulative XP to enter stage index+1


def stage_for_xp(xp: int) -> Dict[str, Any]:
    stage = 1
    for i, t in enumerate(STAGE_THRESHOLDS):
        if xp >= t:
            stage = i + 1
    stage = min(stage, 5)
    lower = STAGE_THRESHOLDS[stage - 1]
    upper = STAGE_THRESHOLDS[stage] if stage < 5 else lower + 400
    within = 100 if stage == 5 else int(round(((xp - lower) / max(upper - lower, 1)) * 100))
    return {"stage": stage, "stage_progress": clamp(within, 0, 100), "xp": xp, "next_stage_xp": upper if stage < 5 else None}


def compute_energy_delta(session_summary: Dict[str, Any]) -> int:
    """XP awarded for this session. Never negative below a floor.

    Rules:
      +6 goal completed within planned duration
      +3 goal completed but ran over time
      +2 for showing up (>= 25% of planned time actually studied)
      -4 ended very early with <50% goal progress
      -2 not showing up at all (< 25% planned time)
    """
    planned = session_summary["planned_duration_seconds"]
    active = session_summary["active_seconds"]
    goal_completed = session_summary.get("goal_completed", False)
    ratio = active / max(planned, 1)
    delta = 0
    if goal_completed and active <= planned:
        delta = 6
    elif goal_completed:
        delta = 3
    elif ratio < 0.25:
        delta = -2
    elif session_summary.get("ended_early") and (session_summary.get("units_done") or 0) < 0.5 * (session_summary.get("goal_units_target") or 0):
        delta = -4
    else:
        delta = 2
    return delta


async def get_or_create_robot(user_id: str) -> Dict[str, Any]:
    doc = await find_one("robot_state", {"user_id": user_id})
    if doc:
        return doc
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "xp": 10,  # tiny starter energy so the robot doesn't feel dead
        "streak_days": 0,
        "last_session_date": None,
        "updated_at": iso(now()),
    }
    await insert("robot_state", doc)
    return doc


async def apply_energy_delta(user_id: str, delta: int) -> Dict[str, Any]:
    state = await get_or_create_robot(user_id)
    new_xp = max(0, int(state["xp"]) + delta)
    today = now().date().isoformat()
    last = state.get("last_session_date")
    streak = int(state.get("streak_days", 0) or 0)
    if last == today:
        pass
    elif last is None:
        streak = 1
    else:
        try:
            last_d = datetime.fromisoformat(last).date()
            if (now().date() - last_d).days == 1:
                streak += 1
            else:
                streak = 1
        except Exception:
            streak = 1
    updated = {"xp": new_xp, "streak_days": streak, "last_session_date": today, "updated_at": iso(now())}
    await upsert("robot_state", {"user_id": user_id}, updated)
    return {**state, **updated, **stage_for_xp(new_xp)}


# ---------------------------------------------------------------------------
# Voice — Claude Sonnet 4.5 phrases the twin's structured facts
# ---------------------------------------------------------------------------
async def twin_voice(payload: VoiceRequest) -> str:
    if not EMERGENT_LLM_KEY:
        # Deterministic fallback so the app is never broken.
        return _fallback_voice(payload)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        system = (
            "You are Aroha — a friendly, calm Digital Twin robot companion for a student. "
            "You will receive JSON facts computed by the Digital Twin's own algorithm. "
            "STRICT RULES: never invent numbers, predictions or behaviour. Only rephrase the given facts. "
            "Speak in the first person (as the robot), warm and encouraging, never preachy. "
            f"Respond in at most {payload.max_sentences} short sentences. No bullet points, no lists, no emojis. "
            "If a fact is missing, keep silent about it — do not guess."
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"twin-voice-{payload.context}-{new_id()[:8]}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        user = UserMessage(text=(
            f"CONTEXT: {payload.context}\n"
            f"TONE: {payload.tone}\n"
            f"FACTS JSON: {payload.facts}"
        ))
        reply = await chat.send_message(user)
        message = (reply or "").strip()
        return message or _fallback_voice(payload)
    except Exception as exc:  # noqa: BLE001
        log.warning("twin_voice LLM failed, using fallback: %s", exc)
        return _fallback_voice(payload)


def _fallback_voice(payload: VoiceRequest) -> str:
    f = payload.facts
    ctx = payload.context
    if ctx == "greeting":
        return "Hey, welcome back. Ready to build another calm streak with me today?"
    if ctx == "pre_session":
        pu = f.get("predicted_units")
        dist = f.get("predicted_distraction_point_minutes")
        subj = f.get("subject_name", "this subject")
        if pu and dist:
            return f"For {subj}, I predict you'll finish about {pu} and drift near minute {dist}. Let's see if you can beat me."
        if dist:
            return f"For {subj}, you usually drift near minute {dist}. Let's stay a little longer this time."
        return f"First {subj} session — I'll be watching quietly and learning your rhythm."
    if ctx == "distraction_help":
        m = f.get("typical_distraction_minute")
        if m:
            return f"You usually feel this dip around minute {m}. Just 10 more minutes and you're back in flow — I've seen it before."
        return "You've done harder blocks than this. One breath, then let's keep going for ten more minutes."
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
    return "I'm here with you."


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "aroha", "ok": True, "time": iso(now())}


# --- Subjects -----------------------------------------------------------------
DEFAULT_SUBJECT_COLORS = ["#F4A261", "#9CAF88", "#E9C46A", "#7C9270", "#E78A61"]
DEFAULT_SUBJECT_ICONS = ["book-open", "zap", "trending-up", "droplet", "globe", "cpu"]


@api.post("/subjects", response_model=Subject)
async def create_subject(body: SubjectCreate):
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
async def list_subjects(user_id: str):
    subjects = await find_many("subjects", {"user_id": user_id}, sort=[("created_at", 1)])
    # Attach profile stats for card previews.
    result = []
    for s in subjects:
        profile = await get_or_create_profile(user_id, s["id"])
        result.append({**s, "profile": profile})
    return result


@api.get("/subjects/{subject_id}")
async def get_subject(subject_id: str, user_id: str):
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
async def predict_session(body: SessionCreate):
    profile = await get_or_create_profile(body.user_id, body.subject_id)
    units = parse_goal_units(body.goal)
    prediction = predict_from_profile(profile, body.planned_duration_minutes * 60, units)
    return {"prediction": prediction.model_dump(), "profile": profile, "parsed_goal_units": units}


@api.post("/sessions")
async def create_session(body: SessionCreate):
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
        "events": [],
        "energy_delta": 0,
    }
    await insert("sessions", session_doc)
    return {"session": session_doc}


@api.post("/sessions/{session_id}/end")
async def end_session(session_id: str, body: SessionEnd):
    session = await find_one("sessions", {"id": session_id})
    if not session:
        raise HTTPException(404, "session not found")
    if session.get("ended_at"):
        raise HTTPException(400, "session already ended")

    events_dump = [e.model_dump() for e in body.events]
    summary = summarise_session_events(body.events)
    planned = int(session["planned_duration_seconds"])
    active = max(0, int(body.active_seconds))
    units_done = body.units_done
    target = session.get("goal_units_target")
    goal_completed = bool(target is not None and units_done is not None and units_done >= target)

    session_summary = {
        "planned_duration_seconds": planned,
        "active_seconds": active,
        "goal_completed": goal_completed,
        "goal_units_target": target,
        "units_done": units_done,
        "ended_early": bool(body.ended_early),
        "distractions": summary["distractions"],
        "breaks": summary["breaks"],
        "first_distraction_at": summary["first_distraction_at"],
        "prediction_snapshot": session.get("prediction_snapshot") or {},
    }

    energy_delta = compute_energy_delta(session_summary)

    # Persist session updates.
    ended_at = iso(now())
    session_update = {
        "ended_at": ended_at,
        "active_seconds": active,
        "units_done": units_done,
        "goal_completed": goal_completed,
        "ended_early": bool(body.ended_early),
        "distractions": summary["distractions"],
        "distraction_points": summary["distraction_points"],
        "breaks": summary["breaks"],
        "first_distraction_at": summary["first_distraction_at"],
        "events": events_dump,
        "energy_delta": energy_delta,
    }
    await db["sessions"].update_one({"id": session_id}, {"$set": session_update})

    # Update twin profile.
    profile = await get_or_create_profile(session["user_id"], session["subject_id"])
    profile = await update_profile_after_session(profile, {**session, **session_update, **{"planned_duration_seconds": planned}})

    # Update robot state.
    robot = await apply_energy_delta(session["user_id"], energy_delta)

    # Comparison payload for the end screen.
    prediction = session.get("prediction_snapshot") or {}
    comparison = {
        "predicted_units": prediction.get("predicted_units"),
        "actual_units": units_done,
        "predicted_focus_minutes": (prediction.get("predicted_focus_seconds") or 0) // 60,
        "actual_focus_minutes": active // 60,
        "predicted_distraction_minute": (prediction.get("predicted_distraction_point_seconds") or 0) // 60,
        "actual_first_distraction_minute": (summary["first_distraction_at"] // 60) if summary["first_distraction_at"] else None,
        "beat_prediction": bool(units_done is not None and prediction.get("predicted_units") is not None and units_done >= prediction["predicted_units"]),
        "goal_completed": goal_completed,
        "ended_early": bool(body.ended_early),
        "energy_delta": energy_delta,
        "robot": robot,
        "stage": stage_for_xp(int(robot["xp"])),
    }

    return {"session": {**session, **session_update}, "profile": profile, "comparison": comparison}


@api.get("/sessions")
async def list_sessions(user_id: str, subject_id: Optional[str] = None, limit: int = 50):
    q: Dict[str, Any] = {"user_id": user_id}
    if subject_id:
        q["subject_id"] = subject_id
    return await find_many("sessions", q, sort=[("started_at", -1)], limit=limit)


# --- Robot --------------------------------------------------------------------
@api.get("/robot/state")
async def robot_state(user_id: str):
    state = await get_or_create_robot(user_id)
    return {**state, **stage_for_xp(int(state["xp"]))}


# --- Voice --------------------------------------------------------------------
@api.post("/twin/voice")
async def voice_endpoint(body: VoiceRequest):
    message = await twin_voice(body)
    return {"message": message}


# --- Analytics ----------------------------------------------------------------
@api.get("/analytics/summary")
async def analytics_summary(user_id: str):
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


@app.on_event("shutdown")
async def _shutdown() -> None:
    client.close()
