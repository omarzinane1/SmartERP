import base64
import binascii

from rest_framework.exceptions import ValidationError


def validate_logo(value):
    """Accept the form's bounded raster data URL; never fetch a client URL."""
    if not value:
        return None, ""
    if not value.startswith(("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")):
        raise ValidationError("Choisissez une image PNG, JPG ou WebP.")
    header, encoded = value.split(",", 1)
    try:
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValidationError("Le contenu du logo est invalide.") from exc
    if not content or len(content) > 2 * 1024 * 1024:
        raise ValidationError("Le logo doit faire au maximum 2 Mo.")
    mime = header.removeprefix("data:").removesuffix(";base64")
    signatures = {
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9"),
        "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }
    if not signatures[mime]:
        raise ValidationError("Le format du logo ne correspond pas à son contenu.")
    return content, mime
