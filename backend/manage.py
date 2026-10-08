import os
import sys


def main():
    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE",
        "config.settings.test" if len(sys.argv) > 1 and sys.argv[1] == "test" else "config.settings.development",
    )

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django n'est pas disponible. "
            "Vérifie que l'environnement virtuel est activé."
        ) from exc

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
