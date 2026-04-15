from unittest.mock import MagicMock, patch

from django.db.utils import OperationalError
from django.test import TestCase


class HealthCheckTests(TestCase):
    def test_health_endpoint_reports_ok(self):
        response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['services']['api'], 'ok')
        self.assertEqual(payload['services']['database'], 'ok')
        self.assertEqual(payload['services']['media_storage'], 'ok')

    @patch('backend.urls.connections')
    def test_health_endpoint_reports_degraded_when_database_is_unavailable(self, mocked_connections):
        mocked_cursor_manager = MagicMock()
        mocked_cursor_manager.__enter__.return_value.execute.side_effect = OperationalError('db unavailable')
        mocked_connections.__getitem__.return_value.cursor.return_value = mocked_cursor_manager

        response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, 503)
        payload = response.json()

        self.assertEqual(payload['status'], 'degraded')
        self.assertEqual(payload['services']['database'], 'error')
        self.assertEqual(payload['services']['media_storage'], 'ok')
