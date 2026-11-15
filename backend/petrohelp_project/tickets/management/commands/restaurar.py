"""
Restaura un respaldo creado con "python manage.py respaldar".

    python manage.py migrate                      (en una base de datos nueva)
    python manage.py restaurar respaldos/petrohelp_AAAAMMDD_HHMMSS.zip

Carga los registros del respaldo (los que ya existan con el mismo id se
sobrescriben con la versión del respaldo) y vuelve a colocar las fotos.
"""
import tempfile
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db.models.signals import post_save, pre_save

from tickets import signals
from tickets.models import Ticket, Usuario


class Command(BaseCommand):
    help = "Restaura la base de datos y las fotos desde un respaldo ZIP."

    def add_arguments(self, parser):
        parser.add_argument("archivo")

    def handle(self, *args, **opts):
        archivo = Path(opts["archivo"])
        if not archivo.exists():
            raise CommandError(f"No existe el archivo {archivo}")

        with zipfile.ZipFile(archivo) as z:
            if "datos.json" not in z.namelist():
                raise CommandError("El ZIP no es un respaldo de PetroHelp (falta datos.json).")

            with tempfile.TemporaryDirectory() as tmp:
                z.extract("datos.json", tmp)
                # Las señales se apagan durante la carga para no generar
                # notificaciones, historial ni tokens duplicados.
                pre_save.disconnect(signals.guardar_estado_anterior, sender=Ticket)
                post_save.disconnect(signals.registrar_historial_y_notificar, sender=Ticket)
                post_save.disconnect(signals.crear_token_usuario, sender=Usuario)
                try:
                    call_command("loaddata", str(Path(tmp) / "datos.json"))
                finally:
                    pre_save.connect(signals.guardar_estado_anterior, sender=Ticket)
                    post_save.connect(signals.registrar_historial_y_notificar, sender=Ticket)
                    post_save.connect(signals.crear_token_usuario, sender=Usuario)

            media = Path(settings.MEDIA_ROOT).resolve()
            fotos = 0
            for nombre in z.namelist():
                if not nombre.startswith("media/") or nombre.endswith("/"):
                    continue
                destino = (media / nombre[len("media/"):]).resolve()
                if media not in destino.parents:  # nunca escribir fuera de media/
                    continue
                destino.parent.mkdir(parents=True, exist_ok=True)
                destino.write_bytes(z.read(nombre))
                fotos += 1

        self.stdout.write(self.style.SUCCESS(
            f"Restaurado: {Usuario.objects.count()} usuarios, {Ticket.objects.count()} tickets, {fotos} fotos."
        ))
