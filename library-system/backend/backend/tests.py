import os
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.core.exceptions import SuspiciousFileOperation
from django.db.utils import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings

from . import settings as project_settings
from .storage_backends import CloudinaryMediaStorage, normalize_upload_name
from . import urls as project_urls


class MediaSettingsTests(SimpleTestCase):
    def test_cloudinary_configuration_detects_url_env(self):
        with patch.dict(
            os.environ,
            {'CLOUDINARY_URL': 'cloudinary://key:secret@demo'},
            clear=True,
        ):
            self.assertTrue(project_settings.has_cloudinary_configuration())

    def test_cloudinary_configuration_detects_split_credentials(self):
        with patch.dict(
            os.environ,
            {
                'CLOUDINARY_CLOUD_NAME': 'demo',
                'CLOUDINARY_API_KEY': 'key',
                'CLOUDINARY_API_SECRET': 'secret',
            },
            clear=True,
        ):
            self.assertTrue(project_settings.has_cloudinary_configuration())

    def test_cloudinary_backend_is_selected_when_enabled(self):
        self.assertEqual(
            project_settings.get_default_media_storage_backend(True),
            'backend.storage_backends.CloudinaryMediaStorage',
        )

    def test_relative_media_urls_are_served_by_default(self):
        self.assertTrue(project_settings.should_serve_media_files_by_default('/media/'))

    def test_absolute_media_urls_are_not_served_by_default(self):
        self.assertFalse(
            project_settings.should_serve_media_files_by_default('https://cdn.example.com/media/')
        )

    def test_prefers_mounted_media_root_when_available(self):
        base_dir = Path('/workspace/base')
        mounted_root = Path('/mounted/media')
        local_root = base_dir / 'media'

        with patch.object(Path, 'exists', autospec=True) as mocked_exists:
            mocked_exists.side_effect = lambda path_obj: path_obj in {
                mounted_root.parent,
                local_root.parent,
            }

            self.assertEqual(
                project_settings.get_default_media_root(
                    base_dir,
                    candidate_roots=(mounted_root, local_root),
                ),
                mounted_root,
            )


class MediaUrlPatternTests(SimpleTestCase):
    @override_settings(DEBUG=False, SERVE_MEDIA_FILES=True, MEDIA_URL='/media/')
    def test_local_media_urls_are_served_when_enabled(self):
        self.assertTrue(project_urls.should_serve_media_files())

    @override_settings(DEBUG=False, SERVE_MEDIA_FILES=True, MEDIA_URL='https://cdn.example.com/media/')
    def test_absolute_media_urls_are_not_served_through_django(self):
        self.assertFalse(project_urls.should_serve_media_files())


class CloudinaryStorageTests(SimpleTestCase):
    @override_settings(CLOUDINARY_MEDIA_FOLDER='salazar-library')
    def test_cloudinary_storage_uses_folder_prefix_and_upload_directory(self):
        storage = CloudinaryMediaStorage()

        self.assertEqual(
            storage._build_upload_folder('book_covers/cover.png'),
            'salazar-library/book_covers',
        )
        self.assertEqual(
            storage._public_id_from_name('book_covers/cover.png'),
            'book_covers/cover',
        )

    def test_normalize_upload_name_rejects_parent_directory_traversal(self):
        with self.assertRaises(SuspiciousFileOperation):
            normalize_upload_name('../secrets.txt')


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
