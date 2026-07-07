import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://twin-learning-hub.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope='session')
def base_url():
    return BASE_URL


@pytest.fixture(scope='session')
def api_client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


@pytest.fixture(scope='session')
def user_id():
    # Unique per test run to avoid collisions.
    return f'TEST_user_{uuid.uuid4().hex[:12]}'
