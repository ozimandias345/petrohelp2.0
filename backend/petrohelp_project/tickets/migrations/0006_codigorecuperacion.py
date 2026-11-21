from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tickets", "0005_sincronizar_usuarios_inactivos"),
    ]

    operations = [
        migrations.CreateModel(
            name="CodigoRecuperacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True,
                                           serialize=False, verbose_name="ID")),
                ("codigo_hash", models.CharField(max_length=128)),
                ("creado", models.DateTimeField(auto_now_add=True)),
                ("expira", models.DateTimeField()),
                ("usado", models.BooleanField(default=False)),
                ("intentos", models.PositiveSmallIntegerField(default=0)),
                ("usuario", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="codigos_recuperacion",
                    to="tickets.usuario")),
            ],
            options={
                "verbose_name": "Codigo de recuperacion",
                "verbose_name_plural": "Codigos de recuperacion",
                "ordering": ["-creado"],
            },
        ),
    ]
