import os
import uuid

import pytest
import requests


def _default_backend_url() -> str:
    env_url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if env_url:
        return env_url.rstrip('/')
    try:
        requests.get('http://127.0.0.1:8000/api/', timeout=1)
        return 'http://127.0.0.1:8000'
    except requests.RequestException:
        return 'https://twin-learning-hub.preview.emergentagent.com'


BASE_URL = _default_backend_url()


@pytest.fixture(scope='session')
def base_url():
    return BASE_URL


@pytest.fixture(scope='session')
def auth_state(base_url):
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    suffix = uuid.uuid4().hex[:12]
    response = session.post(f'{base_url}/api/auth/register', json={
        'role': 'student', 'name': 'Test Student',
        'email': f'test-{suffix}@aroha.local', 'password': 'test-password-123',
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    session.headers.update({'Authorization': f"Bearer {payload['access_token']}"})
    return {'client': session, 'user_id': payload['account']['id']}


@pytest.fixture(scope='session')
def api_client(auth_state):
    return auth_state['client']


@pytest.fixture(scope='session')
def user_id(auth_state):
    return auth_state['user_id']
