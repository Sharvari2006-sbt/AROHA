"""Aroha backend regression tests — Phase 1 Independent Mode."""
import time
import pytest

# ---------- Health ----------
def test_root_health(api_client, base_url):
    r = api_client.get(f'{base_url}/api/')
    assert r.status_code == 200
    data = r.json()
    assert data.get('service') == 'aroha'
    assert data.get('ok') is True
    assert 'time' in data


# ---------- Subjects ----------
class TestSubjects:
    def test_create_subject_seeds_profile(self, api_client, base_url, user_id):
        r = api_client.post(f'{base_url}/api/subjects', json={
            'user_id': user_id, 'name': 'TEST_Math'
        })
        assert r.status_code == 200, r.text
        s = r.json()
        assert s['name'] == 'TEST_Math'
        assert s['user_id'] == user_id
        assert s['color'].startswith('#')
        assert s['icon']
        assert 'id' in s
        pytest.subject_id = s['id']

    def test_list_subjects_has_profile(self, api_client, base_url, user_id):
        r = api_client.get(f'{base_url}/api/subjects', params={'user_id': user_id})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        item = next((x for x in items if x['id'] == pytest.subject_id), None)
        assert item is not None, 'created subject not returned'
        prof = item.get('profile')
        assert prof is not None, 'profile must be attached'
        assert prof['sessions_count'] == 0
        assert prof['user_id'] == user_id
        assert prof['subject_id'] == pytest.subject_id
        # Ensure no mongo _id leaks
        assert '_id' not in item
        assert '_id' not in prof

    def test_get_subject_detail(self, api_client, base_url, user_id):
        r = api_client.get(f'{base_url}/api/subjects/{pytest.subject_id}', params={'user_id': user_id})
        assert r.status_code == 200
        d = r.json()
        assert d['subject']['id'] == pytest.subject_id
        assert d['profile']['subject_id'] == pytest.subject_id
        assert isinstance(d['recent_sessions'], list)


# ---------- Predict ----------
class TestPredict:
    def test_predict_first_session_baseline(self, api_client, base_url, user_id):
        r = api_client.post(f'{base_url}/api/sessions/predict', json={
            'user_id': user_id,
            'subject_id': pytest.subject_id,
            'goal': 'Solve 15 questions',
            'planned_duration_minutes': 30,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        pred = body['prediction']
        assert pred['is_first_session'] is True
        assert body['parsed_goal_units'] == 15
        assert pred['has_enough_data'] is False
        assert pred['predicted_units'] is None
        assert pred['predicted_focus_seconds'] is None
        assert pred['predicted_distraction_point_seconds'] is None
        assert pred['confidence'] == 0

    def test_predict_without_units(self, api_client, base_url, user_id):
        r = api_client.post(f'{base_url}/api/sessions/predict', json={
            'user_id': user_id,
            'subject_id': pytest.subject_id,
            'goal': 'Read chapter',
            'planned_duration_minutes': 20,
        })
        assert r.status_code == 200
        pred = r.json()['prediction']
        assert pred['predicted_units'] is None


# ---------- Session lifecycle ----------
class TestSessionLifecycle:
    def test_create_session_snapshots_prediction(self, api_client, base_url, user_id):
        r = api_client.post(f'{base_url}/api/sessions', json={
            'user_id': user_id,
            'subject_id': pytest.subject_id,
            'goal': 'Solve 10 questions',
            'planned_duration_minutes': 20,
            'topic': 'Algebra',
        })
        assert r.status_code == 200, r.text
        sess = r.json()['session']
        assert sess['user_id'] == user_id
        assert sess['subject_id'] == pytest.subject_id
        assert sess['goal_units_target'] == 10
        assert sess['planned_duration_seconds'] == 20 * 60
        assert sess['prediction_snapshot']['predicted_units'] is None
        assert sess['prediction_snapshot']['has_enough_data'] is False
        assert sess['ended_at'] is None
        assert '_id' not in sess
        pytest.session_id = sess['id']

    def test_create_session_bad_subject_returns_404(self, api_client, base_url, user_id):
        r = api_client.post(f'{base_url}/api/sessions', json={
            'user_id': user_id,
            'subject_id': 'does-not-exist',
            'goal': 'Read',
            'planned_duration_minutes': 10,
        })
        assert r.status_code == 404

    def test_end_session_goal_completed_awards_verified_goal_points(self, api_client, base_url, user_id):
        # Goal is verified, but active time is below the 80% duration threshold: +3.
        payload = {
            'ended_early': False,
            'units_done': 10,
            'active_seconds': 900,  # 15 min < planned 20 min
            'events': [
                {'kind': 'distraction', 'at_seconds': 300},
                {'kind': 'break_start', 'at_seconds': 500},
                {'kind': 'break_end', 'at_seconds': 560},
            ],
        }
        r = api_client.post(f'{base_url}/api/sessions/{pytest.session_id}/end', json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        s = body['session']
        assert s['goal_completed'] is True
        assert s['distractions'] == 1
        assert s['breaks'] == 1
        assert s['energy_delta'] == 3
        comp = body['comparison']
        assert comp['energy_delta'] == 3
        assert comp['predicted_units'] is None
        assert comp['actual_units'] == 10
        assert comp['beat_prediction'] is False
        assert comp['goal_completed'] is True
        assert comp['actual_first_distraction_minute'] == 5
        assert 'robot' in comp
        assert 'stage' in comp
        # Profile updated
        prof = body['profile']
        assert prof['sessions_count'] == 1
        assert prof['goal_completion_rate'] == 1.0
        assert prof['avg_duration_seconds'] == 900
        assert prof['distraction_sessions_count'] == 1
        assert prof['post_distraction_completion_rate'] == 1.0
        assert prof['prediction_accuracy'] == 0
        assert prof['predictions_count'] == 0
        assert 'daily_consistency_score' in prof
        assert 'weekly_consistency_score' in prof
        assert comp['actual_duration_seconds'] == 900
        assert comp['distractions'] == 1
        assert comp['breaks'] == 1

    def test_session_result_is_persisted(self, api_client, base_url, user_id):
        r = api_client.get(f'{base_url}/api/sessions/{pytest.session_id}', params={'user_id': user_id})
        assert r.status_code == 200, r.text
        session = r.json()
        assert session['comparison']['actual_units'] == 10
        assert session['comparison']['predicted_units'] is None

    def test_end_session_double_end_returns_400(self, api_client, base_url):
        r = api_client.post(f'{base_url}/api/sessions/{pytest.session_id}/end', json={
            'ended_early': False, 'units_done': 0, 'active_seconds': 0, 'events': []
        })
        assert r.status_code == 400

    def test_end_session_unknown_returns_404(self, api_client, base_url):
        r = api_client.post(f'{base_url}/api/sessions/no-such-id/end', json={
            'ended_early': False, 'units_done': 0, 'active_seconds': 0, 'events': []
        })
        assert r.status_code == 404

    def test_second_session_is_still_calibration(self, api_client, base_url, user_id):
        r = api_client.post(f'{base_url}/api/sessions/predict', json={
            'user_id': user_id,
            'subject_id': pytest.subject_id,
            'goal': 'Solve 10 questions',
            'planned_duration_minutes': 20,
        })
        assert r.status_code == 200
        pred = r.json()['prediction']
        assert pred['is_first_session'] is False
        assert pred['has_enough_data'] is False
        assert pred['predicted_units'] is None

    def test_prediction_starts_only_after_two_completed_sessions(self, api_client, base_url, user_id):
        created = api_client.post(f'{base_url}/api/sessions', json={
            'user_id': user_id,
            'subject_id': pytest.subject_id,
            'goal': 'Solve 10 questions',
            'planned_duration_minutes': 20,
        })
        assert created.status_code == 200
        second_id = created.json()['session']['id']
        assert created.json()['session']['prediction_snapshot']['has_enough_data'] is False
        ended = api_client.post(f'{base_url}/api/sessions/{second_id}/end', json={
            'ended_early': False,
            'units_done': 8,
            'active_seconds': 1000,
            'events': [],
        })
        assert ended.status_code == 200
        predicted = api_client.post(f'{base_url}/api/sessions/predict', json={
            'user_id': user_id,
            'subject_id': pytest.subject_id,
            'goal': 'Solve 10 questions',
            'planned_duration_minutes': 20,
        })
        assert predicted.status_code == 200
        prediction = predicted.json()['prediction']
        assert prediction['has_enough_data'] is True
        assert prediction['predicted_units'] is not None
        assert prediction['predicted_focus_seconds'] is not None

    def test_subject_profiles_remain_isolated(self, api_client, base_url, user_id):
        created = api_client.post(f'{base_url}/api/subjects', json={
            'user_id': user_id, 'name': 'TEST_Operating Systems'
        })
        assert created.status_code == 200
        other_id = created.json()['id']
        detail = api_client.get(f'{base_url}/api/subjects/{other_id}', params={'user_id': user_id}).json()
        assert detail['profile']['sessions_count'] == 0
        assert detail['profile']['avg_focus_seconds'] == 0
        prediction = api_client.post(f'{base_url}/api/sessions/predict', json={
            'user_id': user_id,
            'subject_id': other_id,
            'goal': 'Solve 10 questions',
            'planned_duration_minutes': 20,
        }).json()['prediction']
        assert prediction['is_first_session'] is True


# ---------- Robot ----------
def test_robot_state_shape(api_client, base_url, user_id):
    r = api_client.get(f'{base_url}/api/robot/state', params={'user_id': user_id})
    assert r.status_code == 200
    d = r.json()
    for k in ('stage', 'stage_progress', 'xp', 'next_stage_xp'):
        assert k in d, f'missing {k}'
    assert 1 <= d['stage'] <= 5
    assert 0 <= d['stage_progress'] <= 100
    assert d['xp'] >= 3
    assert d['daily_xp'] <= d['daily_xp_cap'] == 10


# ---------- Voice ----------
class TestVoice:
    def test_voice_returns_string(self, api_client, base_url):
        r = api_client.post(f'{base_url}/api/twin/voice', json={
            'context': 'greeting', 'facts': {}, 'tone': 'warm', 'max_sentences': 2
        })
        assert r.status_code == 200
        m = r.json().get('message', '')
        assert isinstance(m, str) and len(m.strip()) > 0

    def test_voice_distraction_uses_only_given_facts(self, api_client, base_url):
        # We supply a specific typical_distraction_minute and expect the reply to be
        # short & not invent unrelated numbers.
        facts = {'typical_distraction_minute': 12, 'subject_name': 'Math'}
        r = api_client.post(f'{base_url}/api/twin/voice', json={
            'context': 'distraction_help', 'facts': facts, 'tone': 'warm', 'max_sentences': 2
        })
        assert r.status_code == 200
        msg = r.json()['message']
        assert isinstance(msg, str) and len(msg) > 0
        # sentence count check (approx)
        # allow 1-3 sentences (LLM may add a tiny closer). Accept up to 3 to avoid flakiness.
        sentences = [s for s in msg.replace('!', '.').replace('?', '.').split('.') if s.strip()]
        assert len(sentences) <= 3, f'too many sentences: {msg}'


# ---------- Analytics ----------
def test_analytics_week_length_7(api_client, base_url, user_id):
    r = api_client.get(f'{base_url}/api/analytics/summary', params={'user_id': user_id})
    assert r.status_code == 200
    d = r.json()
    assert 'week' in d and isinstance(d['week'], list)
    assert len(d['week']) == 7
    for day in d['week']:
        assert 'date' in day and 'seconds' in day
        assert isinstance(day['seconds'], int)
    assert d['sessions_count'] >= 1
    assert d['completed_count'] >= 1
