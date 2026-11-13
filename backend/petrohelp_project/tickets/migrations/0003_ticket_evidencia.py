from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0002_notificacion_leido'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='evidencia',
            field=models.ImageField(blank=True, null=True, upload_to='evidencias/'),
        ),
    ]
