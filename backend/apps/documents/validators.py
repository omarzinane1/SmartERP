from io import BytesIO
from pathlib import PurePosixPath
import re
import warnings
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from rest_framework.exceptions import ValidationError

MAX_BYTES = 15 * 1024 * 1024
TYPES = {".pdf": "application/pdf", ".txt": "text/plain", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


def validate_upload(upload):
    if not upload.size or upload.size > MAX_BYTES:
        raise ValidationError("Le fichier doit contenir entre 1 octet et 15 Mo.")
    name = PurePosixPath(upload.name.replace("\\", "/")).name
    name = re.sub(r'[\x00-\x1f\x7f<>:"|?*]', "_", name).strip(" .")
    extension = PurePosixPath(name).suffix.lower()
    if extension not in TYPES or upload.content_type != TYPES[extension]:
        raise ValidationError("Extension ou type MIME non autorisé.")
    if len(name) > 180:
        name = name[:180-len(extension)] + extension
    data = upload.read(MAX_BYTES+1)
    upload.seek(0)
    if len(data) != upload.size or len(data) > MAX_BYTES:
        raise ValidationError("Taille de fichier incohérente.")
    pages = 1
    try:
        if extension == ".pdf":
            if not data.startswith(b"%PDF-"):
                raise ValueError()
            reader = PdfReader(BytesIO(data), strict=True)
            if reader.is_encrypted:
                raise ValueError()
            pages = len(reader.pages)
            if not 1 <= pages <= 500:
                raise ValueError()
            # Active content and embedded payloads are not accepted by this upload surface.
            root = reader.trailer["/Root"]
            if any(key in root for key in ("/OpenAction", "/AA")) or any(key in root.get("/Names", {}) for key in ("/JavaScript", "/EmbeddedFiles")):
                raise ValueError()
        elif extension == ".txt":
            text = data.decode("utf-8-sig")
            if any(ord(c) < 32 and c not in "\n\r\t" for c in text):
                raise ValueError()
            pages = max(1, (len(text)+9999)//10000)
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(data)) as image:
                    if image.width * image.height > 25_000_000 or Image.MIME.get(image.format) != TYPES[extension]:
                        raise ValueError()
                    image.verify()
    except Exception as error:
        # Parser failures are invalid user files, never HTTP 500 or exposed parser internals.
        raise ValidationError("Le contenu du fichier est invalide, chiffré ou dépasse les limites autorisées.") from error
    return dict(name=name, original_filename=name, mime_type=TYPES[extension], size=len(data), page_count=pages)
