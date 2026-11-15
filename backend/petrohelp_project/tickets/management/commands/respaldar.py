"""
Respaldo de PetroHelp (base de datos + fotos de evidencia).

    python manage.py respaldar

Crea respaldos/petrohelp_AAAAMMDD_HHMMSS.zip con:
  - datos.json  -> todos los registros (usuarios, tickets, comentarios,
                   historial, notificaciones, catálogos y tokens)
  - media/      -> fotos de evidencia de los tickets
  - LEEME.txt   -> fecha, totales y cómo restaurar

Conserva los últimos 10 respaldos (--conservar N para cambiarlo).
"""
import io
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from tickets.models import Ticket, Usuario


class Command(BaseCommand):
    help = "Genera un respaldo ZIP de la base de datos y de las fotos de evidencia."

    def add_arguments(self, parser):
        parser.add_argument("--carpeta", default=str(Path(settings.BASE_DIR) / "respaldos"))
        parser.add_argument("--conservar", type=int, default=10)

    def handle(self, *args, **opts):
        carpeta = Path(opts["carpeta"])
        carpeta.mkdir(parents=True, exist_ok=True)
        ahora = timezone.localtime()
        destino = carpeta / f"petrohelp_{ahora:%Y%m%d_%H%M%S}.zip"

        datos = io.StringIO()
        call_command("dumpdata", "tickets", "authtoken", indent=1, stdout=datos)

        media = Path(settings.MEDIA_ROOT)
        fotos = [f for f in media.rglob("*") if f.is_file()] if media.exists() else []

        with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("datos.json", datos.getvalue())
            for f in fotos:
                z.write(f, Path("media") / f.relative_to(media))
            z.writestr("LEEME.txt", (
                f"Respaldo de PetroHelp\nFecha: {ahora:%d/%m/%Y %H:%M:%S}\n"
                f"Usuarios: {Usuario.objects.count()}\nTickets: {Ticket.objects.count()}\n"
                f"Fotos de evidencia: {len(fotos)}\n\n"
                "Restaurar: python manage.py restaurar <este_archivo.zip>\n"
            ))

        # Rotación: se conservan solo los más recientes
        viejos = sorted(carpeta.glob("petrohelp_*.zip"))[: -opts["conservar"]] if opts["conservar"] > 0 else []
        for v in viejos:
            v.unlink()

        self.stdout.write(self.style.SUCCESS(
            f"Respaldo creado: {destino} ({destino.stat().st_size // 1024} KB, "
            f"{Ticket.objects.count()} tickets, {len(fotos)} fotos)"
        ))
        return str(destino)
