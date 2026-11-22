from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0006_codigorecuperacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="estacion",
            field=models.ForeignKey(
                blank=True,
                help_text="Estacion donde trabaja. Se usa como estacion sugerida "
                          "al registrar una incidencia.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="usuarios",
                to="tickets.estacion",
            ),
        ),
    ]
