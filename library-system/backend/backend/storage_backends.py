from __future__ import annotations

import posixpath

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured, SuspiciousFileOperation
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


def get_cloudinary_modules():
    try:
        import cloudinary
        import cloudinary.uploader
        from cloudinary.utils import cloudinary_url
    except ImportError as exc:
        raise ImproperlyConfigured(
            'Cloudinary media storage requires the cloudinary package to be installed.'
        ) from exc
    return cloudinary, cloudinary.uploader, cloudinary_url


def normalize_upload_name(name: str | None) -> str:
    normalized = str(name or '').strip().replace('\\', '/')
    if not normalized:
        return 'upload'
    normalized = posixpath.normpath(normalized).lstrip('/')
    if normalized in {'', '.'}:
        return 'upload'
    if normalized == '..' or normalized.startswith('../'):
        raise SuspiciousFileOperation(f'Invalid upload path: {name!r}')
    return normalized


@deconstructible
class CloudinaryMediaStorage(Storage):
    def __init__(self, folder: str | None = None, resource_type: str = 'image') -> None:
        self.folder = self._normalize_folder(
            folder if folder is not None else getattr(settings, 'CLOUDINARY_MEDIA_FOLDER', '')
        )
        self.resource_type = resource_type

    def _normalize_folder(self, folder: str | None) -> str:
        cleaned = str(folder or '').strip().replace('\\', '/')
        parts = [part for part in cleaned.split('/') if part not in {'', '.', '..'}]
        return '/'.join(parts)

    def _split_name(self, name: str) -> tuple[str, str]:
        normalized = normalize_upload_name(name)
        directory, filename = posixpath.split(normalized)
        return directory, filename or 'upload'

    def _build_upload_folder(self, name: str) -> str:
        directory, _ = self._split_name(name)
        parts = [self.folder, directory]
        return '/'.join(part for part in parts if part)

    def _public_id_from_name(self, name: str) -> str:
        normalized = normalize_upload_name(name)
        root, _ext = posixpath.splitext(normalized)
        return root or normalized

    def _open(self, name, mode='rb'):
        raise NotImplementedError('Cloudinary media files are not opened through Django storage.')

    def _save(self, name, content):
        _cloudinary, uploader, _cloudinary_url = get_cloudinary_modules()

        normalized_name = normalize_upload_name(name)
        upload_options = {
            'resource_type': self.resource_type,
            'folder': self._build_upload_folder(normalized_name) or None,
            'use_filename': True,
            'unique_filename': True,
            'overwrite': False,
            'invalidate': True,
        }
        upload_options = {key: value for key, value in upload_options.items() if value is not None}

        if hasattr(content, 'open'):
            content.open('rb')
        if hasattr(content, 'seek'):
            content.seek(0)

        result = uploader.upload(content, **upload_options)
        public_id = str(result.get('public_id') or '').strip()
        if not public_id:
            raise ImproperlyConfigured('Cloudinary upload did not return a public_id.')
        return public_id

    def delete(self, name):
        if not name:
            return
        _cloudinary, uploader, _cloudinary_url = get_cloudinary_modules()
        uploader.destroy(
            self._public_id_from_name(name),
            resource_type=self.resource_type,
            invalidate=True,
        )

    def exists(self, name):
        return False

    def path(self, name):
        raise NotImplementedError('Cloudinary media files do not have a local filesystem path.')

    def size(self, name):
        raise NotImplementedError('Cloudinary media file size is not available through this storage backend.')

    def url(self, name):
        raw_name = str(name or '').strip()
        if not raw_name:
            return raw_name
        if raw_name.startswith(('http://', 'https://', '/')):
            return raw_name

        _cloudinary, _uploader, cloudinary_url = get_cloudinary_modules()
        url, _options = cloudinary_url(
            self._public_id_from_name(raw_name),
            resource_type=self.resource_type,
            type='upload',
            secure=True,
        )
        return url
