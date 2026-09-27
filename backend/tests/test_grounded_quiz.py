import asyncio
from datetime import timedelta

from backend import server
from backend.server import AssignmentDoubtRequest, TwinChatRequest, VoiceRequest, _fallback_voice, build_grounded_fallback_questions, predict_from_profile


MATERIAL = """
Linked lists store nodes connected by references. Each node contains data and a
pointer to the next node. The head pointer identifies the first node in the
sequence. Insertion at the beginning changes the head reference. Deletion
requires reconnecting adjacent node references. A doubly linked list stores
previous and next references. Traversal begins at the head and follows
references. The final node usually stores a null next reference.
"""


def test_local_quiz_is_deterministic_and_grounded():
    first = build_grounded_fallback_questions(MATERIAL, "Linked Lists")
    second = build_grounded_fallback_questions(MATERIAL, "Linked Lists")

    assert first == second
    assert len(first) >= 5
    for question in first:
        assert len(question["choices"]) == 4
        assert 0 <= question["answer"] <= 3
        assert question["choices"][question["answer"]] in question["explanation"]
        assert question["source"] == "grounded_local"


def test_twin_chat_fallback_preserves_computed_insight():
    answer = "Your verified goal completion rate is 75%."
    message = _fallback_voice(VoiceRequest(
        context="generic", facts={"structured_answer": answer}, tone="focused", max_sentences=3,
    ))
    assert message == answer


def test_reo_local_chat_fallback_varies_with_conversation():
    first = server.friendly_chat_fallback("I just wanted to say something", None, [], "Asha")
    second = server.friendly_chat_fallback(
        "There is more",
        None,
        [{"from": "me", "text": "I just wanted to say something"}],
        "Asha",
    )
    focus = server.friendly_chat_fallback("I cannot focus today", None, [], "Asha")
    assert first != second
    assert "five minutes" in focus
    assert "I can answer questions about" not in first + second + focus


def test_reo_calibrates_twice_then_challenges_without_random_numbers():
    base = {"goal_units_ratio": 0.8, "goal_unit_sessions_count": 2, "avg_focus_seconds": 1200, "goal_completion_rate": 0.5}
    first = predict_from_profile({**base, "sessions_count": 0}, 1500, 10)
    second = predict_from_profile({**base, "sessions_count": 1}, 1500, 10)
    third = predict_from_profile({**base, "sessions_count": 2}, 1500, 10)
    assert first.has_enough_data is False and first.predicted_units is None and first.predicted_focus_seconds is None
    assert second.has_enough_data is False and second.predicted_units is None and second.predicted_focus_seconds is None
    assert third.has_enough_data is True and third.predicted_units == 8 and third.predicted_focus_seconds == 1200
    calibration = _fallback_voice(VoiceRequest(context="pre_session", facts={
        "subject_name": "Physics", "has_enough_data": False, "previous_subject_sessions": 1,
    }, tone="warm", max_sentences=2))
    challenge = _fallback_voice(VoiceRequest(context="pre_session", facts={
        "subject_name": "Physics", "has_enough_data": True, "predicted_units": 8, "predicted_focus_minutes": 20,
    }, tone="playful", max_sentences=2))
    assert "still studying your rhythm" in calibration.lower() and not any(character.isdigit() for character in calibration)
    assert "beat me" in challenge.lower()


def test_reo_energy_loss_and_stage_shrink_are_gradual():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_mongo = server.mongo_available
        try:
            server.ALLOW_MEMORY_DB = True
            server.mongo_available = False
            server.memory_db.collections.clear()
            old_day = (server.now().date() - timedelta(days=40)).isoformat()
            state = {
                "id": "robot-1", "user_id": "student-1", "xp": 100, "streak_days": 7, "best_streak": 7,
                "discipline_days": 10, "evolution_stage": 2, "last_qualified_date": old_day,
                "last_activity_date": old_day, "last_stage_change_date": old_day,
                "decayed_missed_days": 0, "last_energy_decay_date": old_day,
            }
            await server.insert("accounts", {"id": "student-1", "role": "student"})
            await server.insert("robot_state", state)
            decayed = await server.apply_inactivity_decay(state)
            assert decayed["evolution_stage"] == 1
            assert decayed["streak_days"] == 0
            assert 0 < decayed["xp"] < 100
            unchanged = await server.apply_inactivity_decay(decayed)
            assert unchanged["xp"] == decayed["xp"]
            penalized = await server.apply_energy_delta("student-1", -2)
            assert penalized["awarded_delta"] == -2
            assert penalized["xp"] == decayed["xp"] - 2
            assert penalized["evolution_stage"] == 1
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.mongo_available = original_mongo

    asyncio.run(exercise())


def test_reo_evolves_only_after_xp_and_discipline_days_are_both_met():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_mongo = server.mongo_available
        try:
            server.ALLOW_MEMORY_DB = True
            server.mongo_available = False
            server.memory_db.collections.clear()
            yesterday = (server.now().date() - timedelta(days=1)).isoformat()
            await server.insert("accounts", {"id": "growing-student", "role": "student"})
            await server.insert("robot_state", {
                "id": "robot-growth", "user_id": "growing-student", "xp": 60,
                "streak_days": 6, "best_streak": 6, "discipline_days": 6,
                "evolution_stage": 1, "last_qualified_date": yesterday,
                "last_activity_date": yesterday, "last_stage_change_date": yesterday,
                "decayed_missed_days": 0, "last_energy_decay_date": yesterday,
            })
            grown = await server.apply_energy_delta("growing-student", 10)
            assert grown["xp"] == 70
            assert grown["discipline_days"] == 7
            assert grown["streak_days"] == 7
            assert grown["evolution_stage"] == 2
            assert grown["stage"] == 2
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.mongo_available = original_mongo

    asyncio.run(exercise())


def test_twin_chat_handles_greeting_and_follow_up_without_repeating_menu():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_key = server.ANTHROPIC_API_KEY
        original_mongo = server.mongo_available
        try:
            server.ALLOW_MEMORY_DB = True
            server.ANTHROPIC_API_KEY = ""
            server.mongo_available = False
            server.memory_db.collections.clear()
            account = {"id": "chat-user", "role": "student", "name": "Asha"}
            greeting = await server.twin_chat_endpoint(
                TwinChatRequest(user_id="chat-user", question="Hiii"), account,
            )
            follow_up = await server.twin_chat_endpoint(
                TwinChatRequest(user_id="chat-user", question="Yes tell me then"), account,
            )
            assert "Hi Asha" in greeting["message"]
            assert "don't have" in follow_up["message"]
            assert greeting["message"] != follow_up["message"]
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.ANTHROPIC_API_KEY = original_key
            server.mongo_available = original_mongo

    asyncio.run(exercise())


def test_generic_twin_chat_uses_conversation_instead_of_a_repeated_menu():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_key = server.ANTHROPIC_API_KEY
        original_mongo = server.mongo_available
        original_anthropic = server.anthropic_text

        async def fake_anthropic(**kwargs):
            assert "LATEST_STUDENT_MESSAGE: Explain recursion simply" in kwargs["user"]
            assert "RECENT_CONVERSATION" in kwargs["user"]
            return "Recursion is when a solution handles a smaller version of the same problem until it reaches a stopping case."

        try:
            server.ALLOW_MEMORY_DB = True
            server.ANTHROPIC_API_KEY = "configured-for-test"
            server.anthropic_text = fake_anthropic
            server.mongo_available = False
            server.memory_db.collections.clear()
            account = {"id": "chat-user", "role": "student", "name": "Asha"}
            result = await server.twin_chat_endpoint(
                TwinChatRequest(user_id="chat-user", question="Explain recursion simply"), account,
            )
            assert result["message"].startswith("Recursion is")
            assert "I can answer questions about" not in result["message"]
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.ANTHROPIC_API_KEY = original_key
            server.anthropic_text = original_anthropic
            server.mongo_available = original_mongo

    asyncio.run(exercise())


def test_known_twin_insights_also_use_history_aware_friend_voice():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_key = server.ANTHROPIC_API_KEY
        original_mongo = server.mongo_available
        original_anthropic = server.anthropic_text

        async def fake_anthropic(**kwargs):
            assert "VERIFIED_BEHAVIOURAL_ANSWER" in kwargs["user"]
            assert "discipline streak is 0 days" in kwargs["user"]
            assert "I had a rough day" in kwargs["user"]
            return "A rough day doesn't erase your progress. Your streak is at zero right now, so let's make the next step small and doable."

        try:
            server.ALLOW_MEMORY_DB = True
            server.ANTHROPIC_API_KEY = "configured-for-test"
            server.anthropic_text = fake_anthropic
            server.mongo_available = False
            server.memory_db.collections.clear()
            account = {"id": "chat-user", "role": "student", "name": "Asha"}
            result = await server.twin_chat_endpoint(
                TwinChatRequest(
                    user_id="chat-user",
                    question="How is my consistency?",
                    history=[
                        {"from": "me", "text": "I had a rough day"},
                        {"from": "twin", "text": "I'm here with you."},
                    ],
                ),
                account,
            )
            assert result["message"].startswith("A rough day")
            assert "I can answer questions about" not in result["message"]
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.ANTHROPIC_API_KEY = original_key
            server.anthropic_text = original_anthropic
            server.mongo_available = original_mongo

    asyncio.run(exercise())


def test_assignment_doubt_is_grounded_and_locks_during_assessment():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_key = server.ANTHROPIC_API_KEY
        original_mongo = server.mongo_available
        try:
            server.ALLOW_MEMORY_DB = True
            server.ANTHROPIC_API_KEY = ""
            server.mongo_available = False
            server.memory_db.collections.clear()
            account = {"id": "child-1", "role": "child", "name": "Asha"}
            await server.insert("assignments", {
                "id": "assignment-1", "child_id": "child-1", "parent_id": "parent-1",
                "subject": "Computer Science", "title": "Linked Lists", "topic": "Linked Lists",
                "material_ids": ["material-1"], "study_completed": False, "quiz_unlocked": False,
            })
            await server.insert("materials", {
                "id": "material-1", "child_id": "child-1", "parent_id": "parent-1", "title": "Chapter 2",
                "kind": "note", "note_text": "A linked list stores nodes connected by references. The head identifies the first node.",
            })
            result = await server.assignment_doubt(
                "assignment-1", AssignmentDoubtRequest(question="What does a linked list store?"), account,
            )
            assert "linked list stores nodes" in result["message"].lower()
            await server.insert("quiz_attempts", {
                "id": "attempt-1", "assignment_id": "assignment-1", "child_id": "child-1", "status": "active",
            })
            active = await server.active_assessment(account)
            assert active == {"active": True, "assignment_id": "assignment-1", "attempt_id": "attempt-1"}
            try:
                await server.assignment_doubt(
                    "assignment-1", AssignmentDoubtRequest(question="Tell me the quiz answer"), account,
                )
                raise AssertionError("Doubt chat should be locked during assessment")
            except Exception as exc:
                assert getattr(exc, "status_code", None) == 423
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.ANTHROPIC_API_KEY = original_key
            server.mongo_available = original_mongo

    asyncio.run(exercise())


def test_highlight_revision_pdf_contains_metadata_and_highlights(tmp_path):
    output = tmp_path / "revision.pdf"
    server.render_highlight_pdf(output, {
        "student": "Asha", "subject": "Physics", "topic": "Wave Functions", "date": "13 July 2026",
    }, [
        {"material_title": "Chapter 4", "text": "Normalization makes the total probability equal to one."},
        {"material_title": "Chapter 4", "text": "The wave function describes the state of the system."},
        {"material_title": "Practice notes", "text": "Probability density is obtained from the wave function magnitude."},
    ])
    from pypdf import PdfReader
    text = "\n".join(page.extract_text() or "" for page in PdfReader(str(output)).pages)
    assert output.stat().st_size > 2000
    assert "Aroha Revision Notes" in text
    assert "Physics - Wave Functions" in text
    assert "Normalization makes the total probability equal to one." in text
    assert "The wave function describes the state of the system." in text
    assert "Probability density is obtained from the wave function magnitude." in text


def test_revision_library_is_child_scoped_and_locked_during_quiz():
    async def exercise():
        original_allow = server.ALLOW_MEMORY_DB
        original_mongo = server.mongo_available
        try:
            server.ALLOW_MEMORY_DB = True
            server.mongo_available = False
            server.memory_db.collections.clear()
            child = {"id": "library-child", "role": "child", "name": "Asha"}
            await server.insert("assignments", {
                "id": "own-assignment", "child_id": "library-child", "parent_id": "parent-1",
                "title": "Read waves", "subject": "Physics", "topic": "Wave Functions",
                "updated_at": "2026-07-14T10:00:00+00:00",
            })
            await server.insert("assignments", {
                "id": "other-assignment", "child_id": "other-child", "parent_id": "parent-2",
                "title": "Private notes", "subject": "Maths", "topic": "Algebra",
                "updated_at": "2026-07-14T11:00:00+00:00",
            })
            await server.insert("material_highlights", {
                "id": "own-highlight", "assignment_id": "own-assignment", "child_id": "library-child",
                "material_id": "material-1", "material_title": "Chapter 4", "text": "A saved wave note.",
                "active": True, "created_at": "2026-07-14T10:00:00+00:00", "updated_at": "2026-07-14T10:00:00+00:00",
            })
            await server.insert("material_highlights", {
                "id": "other-highlight", "assignment_id": "other-assignment", "child_id": "other-child",
                "material_id": "material-2", "material_title": "Chapter 1", "text": "Another child's note.",
                "active": True, "created_at": "2026-07-14T11:00:00+00:00", "updated_at": "2026-07-14T11:00:00+00:00",
            })
            notes = await server.list_revision_notes(child)
            assert len(notes) == 1
            assert notes[0]["assignment_id"] == "own-assignment"
            assert notes[0]["highlight_count"] == 1

            await server.insert("quiz_attempts", {
                "id": "active-attempt", "assignment_id": "own-assignment",
                "child_id": "library-child", "status": "active",
            })
            try:
                await server.list_revision_notes(child)
                raise AssertionError("Revision notes should be locked during an active quiz")
            except Exception as exc:
                assert getattr(exc, "status_code", None) == 423
        finally:
            server.memory_db.collections.clear()
            server.ALLOW_MEMORY_DB = original_allow
            server.mongo_available = original_mongo

    asyncio.run(exercise())
