from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0003_ticket_evidencia"),
    ]

    operations = [
        migrations.AddField(
            model_name="estacion",
            name="latitud",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="estacion",
            name="longitud",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
