from django.db import migrations


def desactivar(apps, schema_editor):
    # Los usuarios marcados como inactivos en la página seguían pudiendo
    # iniciar sesión; aquí se les bloquea el acceso de verdad.
    Usuario = apps.get_model("tickets", "Usuario")
    Usuario.objects.filter(activo=False, is_superuser=False).update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0004_estacion_ubicacion"),
    ]

    operations = [
        migrations.RunPython(desactivar, migrations.RunPython.noop),
    ]
