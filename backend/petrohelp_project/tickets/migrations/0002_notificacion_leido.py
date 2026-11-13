# Generado a mano (agrega el campo "leido" a Notificacion, para
# poder marcar como vistas las notificaciones desde el frontend).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='notificacion',
            name='leido',
            field=models.BooleanField(default=False),
        ),
    ]
