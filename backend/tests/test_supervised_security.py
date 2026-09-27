import uuid

import requests


def register(base_url, role, name, email, password='secure-password-123', invite_code=None):
    response = requests.post(f'{base_url}/api/auth/register', json={
        'role': role, 'name': name, 'email': email, 'password': password, 'invite_code': invite_code,
    })
    return response


def auth(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


def test_real_parent_child_link_and_family_isolation(base_url):
    suffix = uuid.uuid4().hex[:10]
    parent = register(base_url, 'parent', 'Secure Parent', f'parent-{suffix}@aroha.local')
    assert parent.status_code == 200, parent.text
    parent_data = parent.json()
    parent_headers = auth(parent_data['access_token'])
    code = parent_data['account']['inviteCode']

    child = register(base_url, 'child', 'Linked Child', f'child-{suffix}@aroha.local', invite_code=code)
    assert child.status_code == 200, child.text
    child_data = child.json()
    assert child_data['account']['linkStatus'] == 'pending'

    reused = register(base_url, 'child', 'Intruder', f'intruder-{suffix}@aroha.local', invite_code=code)
    assert reused.status_code == 400

    links = requests.get(f'{base_url}/api/family/children', headers=parent_headers)
    assert links.status_code == 200
    link = next(item for item in links.json() if item['child']['id'] == child_data['account']['id'])
    approved = requests.patch(
        f"{base_url}/api/family/links/{link['link_id']}", headers=parent_headers, json={'approved': True},
    )
    assert approved.status_code == 200

    child_login = requests.post(f'{base_url}/api/auth/login', json={
        'role': 'child', 'email': f'child-{suffix}@aroha.local', 'password': 'secure-password-123',
    })
    assert child_login.status_code == 200
    assert child_login.json()['account']['linkStatus'] == 'approved'
    parent_login = requests.post(f'{base_url}/api/auth/login', json={
        'role': 'parent', 'email': f'parent-{suffix}@aroha.local', 'password': 'secure-password-123',
    })
    assert parent_login.status_code == 200
    assert parent_login.json()['account']['inviteCode'].startswith('TWIN-')
    cannot_reject_approved = requests.patch(
        f"{base_url}/api/family/links/{link['link_id']}", headers=parent_headers, json={'approved': False},
    )
    assert cannot_reject_approved.status_code == 409

    assignment = requests.post(f'{base_url}/api/supervised/assignments', headers=parent_headers, json={
        'child_id': child_data['account']['id'], 'title': 'Read linked lists', 'subject': 'Data Structures',
        'topic': 'Linked lists', 'planned_duration_minutes': 25, 'material_ids': [], 'quiz_required': False,
    })
    assert assignment.status_code == 200, assignment.text

    child_rows = requests.get(f'{base_url}/api/supervised/assignments', headers=auth(child_data['access_token']))
    assert child_rows.status_code == 200
    assert [row['id'] for row in child_rows.json()] == [assignment.json()['id']]

    child_headers = auth(child_data['access_token'])
    assignment_detail = requests.get(
        f"{base_url}/api/supervised/assignments/{assignment.json()['id']}", headers=child_headers,
    )
    assert assignment_detail.status_code == 200

    material = requests.post(
        f'{base_url}/api/supervised/materials', headers={'Authorization': parent_headers['Authorization']},
        data={
            'child_id': child_data['account']['id'], 'title': 'Linked list notes', 'kind': 'note',
            'note_text': 'Linked lists store nodes connected by references.',
        },
    )
    assert material.status_code == 200, material.text
    material_id = material.json()['id']
    content = requests.get(f'{base_url}/api/supervised/materials/{material_id}/content', headers=child_headers)
    assert content.status_code == 200
    assert 'connected by references' in content.json()['content']

    gated = requests.post(f'{base_url}/api/supervised/assignments', headers=parent_headers, json={
        'child_id': child_data['account']['id'], 'title': 'Study linked list notes', 'subject': 'Data Structures',
        'topic': 'Linked lists', 'planned_duration_minutes': 20, 'material_ids': [material_id], 'quiz_required': True,
    })
    assert gated.status_code == 200, gated.text
    gated_id = gated.json()['id']
    locked = requests.post(f'{base_url}/api/supervised/assignments/{gated_id}/quiz/begin', headers=child_headers)
    assert locked.status_code == 423
    too_early = requests.post(
        f'{base_url}/api/supervised/assignments/{gated_id}/study/complete', headers=child_headers,
        json={'active_seconds': 299, 'material_progress': 1, 'background_events': 0, 'student_marked_done': True},
    )
    assert too_early.status_code == 200
    assert too_early.json()['study_completed'] is False
    incomplete_material = requests.post(
        f'{base_url}/api/supervised/assignments/{gated_id}/study/complete', headers=child_headers,
        json={'active_seconds': 1200, 'material_progress': 0.99, 'background_events': 0},
    )
    assert incomplete_material.status_code == 200
    assert incomplete_material.json()['study_completed'] is False
    completed_study = requests.post(
        f'{base_url}/api/supervised/assignments/{gated_id}/study/complete', headers=child_headers,
        json={'active_seconds': 300, 'material_progress': 1, 'background_events': 0, 'student_marked_done': True},
    )
    assert completed_study.status_code == 200
    assert completed_study.json()['study_completed'] is True
    assert completed_study.json()['ended_early'] is True
    assert completed_study.json()['study_points_awarded'] <= 5
    assert completed_study.json()['quiz_unlocked'] is False  # Generation must be grounded and ready first.

    stranger = register(base_url, 'student', 'Other Student', f'other-{suffix}@aroha.local')
    stranger_headers = auth(stranger.json()['access_token'])
    forbidden = requests.get(
        f'{base_url}/api/subjects', params={'user_id': child_data['account']['id']}, headers=stranger_headers,
    )
    assert forbidden.status_code == 403

    removed = requests.delete(f"{base_url}/api/family/links/{link['link_id']}", headers=parent_headers)
    assert removed.status_code == 200
    child_after_remove = requests.post(f'{base_url}/api/auth/login', json={
        'role': 'child', 'email': f'child-{suffix}@aroha.local', 'password': 'secure-password-123',
    })
    assert child_after_remove.status_code == 200
    assert child_after_remove.json()['account']['linkStatus'] == 'unlinked'


def test_login_does_not_create_accounts_or_accept_wrong_password(base_url):
    suffix = uuid.uuid4().hex[:10]
    email = f'login-{suffix}@aroha.local'
    created = register(base_url, 'student', 'Login Student', email)
    assert created.status_code == 200
    wrong = requests.post(f'{base_url}/api/auth/login', json={
        'role': 'student', 'email': email, 'password': 'wrong-password',
    })
    assert wrong.status_code == 401
    missing = requests.post(f'{base_url}/api/auth/login', json={
        'role': 'student', 'email': f'missing-{suffix}@aroha.local', 'password': 'secure-password-123',
    })
    assert missing.status_code == 401
