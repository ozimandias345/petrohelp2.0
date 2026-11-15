"""
Prepara una base de datos nueva en la nube (Render):

- Crea el administrador global con ADMIN_USERNAME / ADMIN_PASSWORD
  (variables de entorno), porque el plan gratis no tiene consola.
- Si la base está vacía, crea un catálogo inicial de departamentos,
  categorías y estaciones para poder usar el sistema de inmediato.

Se puede ejecutar muchas veces: no duplica nada.
"""
import os

from django.core.management.base import BaseCommand

from tickets.models import Categoria, Departamento, Estacion, Usuario

CATALOGO = {
    "Mantenimiento": ["Bombas y dispensarios", "Instalación eléctrica", "Infraestructura"],
    "Seguridad": ["Fuga de gas", "Derrame de combustible", "Extintores y señalización"],
    "Operaciones": ["Reabastecimiento de tanques", "Sistema de cobro", "Limpieza"],
}
ESTACIONES = [
    ("Estación 1 - Centro", "Zona Centro, Tijuana, B.C.", 32.530800, -117.036800),
    ("Estación 2 - Otay", "Mesa de Otay, Tijuana, B.C.", 32.532500, -116.966000),
    ("Estación 3 - Playas", "Playas de Tijuana, B.C.", 32.522000, -117.116500),
]


class Command(BaseCommand):
    help = "Crea el administrador y el catálogo inicial en una base de datos nueva."

    def handle(self, *args, **options):
        usuario = os.getenv("ADMIN_USERNAME")
        clave = os.getenv("ADMIN_PASSWORD")
        if usuario and clave:
            admin, creado = Usuario.objects.get_or_create(
                username=usuario,
                defaults={"rol": "admin_global", "is_staff": True, "is_superuser": True},
            )
            if creado:
                admin.set_password(clave)
                admin.save()
                self.stdout.write(f"Administrador '{usuario}' creado.")
            else:
                self.stdout.write(f"El administrador '{usuario}' ya existía; no se modificó.")
        else:
            self.stdout.write("Sin ADMIN_USERNAME/ADMIN_PASSWORD: no se creó administrador.")

        if not Departamento.objects.exists():
            for depto, categorias in CATALOGO.items():
                d = Departamento.objects.create(nombre=depto)
                for c in categorias:
                    Categoria.objects.create(nombre=c, departamento=d)
            self.stdout.write("Departamentos y categorías iniciales creados.")

        if not Estacion.objects.exists():
            for nombre, direccion, lat, lng in ESTACIONES:
                Estacion.objects.create(nombre=nombre, direccion=direccion, latitud=lat, longitud=lng)
            self.stdout.write("Estaciones iniciales creadas.")
