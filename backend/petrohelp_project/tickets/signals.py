"""
Señales de PetroHelp.

Aquí vive la lógica que antes hacíamos a mano desde el admin:
- Cuando se crea un ticket, se genera su primera notificación sola.
- Cuando cambia el estado de un ticket, se registra en el Historial
  y se genera una Notificación automáticamente (RF-08, RF-09).
"""

from django.db.models import Q
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

from .models import Ticket, HistorialTicket, Notificacion, Usuario


# =========================================================
# Guarda el estado "anterior" del ticket antes de guardarlo,
# para poder comparar en el post_save si cambió.
# =========================================================
@receiver(pre_save, sender=Ticket)
def guardar_estado_anterior(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._estado_anterior = Ticket.objects.get(pk=instance.pk).estado
        except Ticket.DoesNotExist:
            instance._estado_anterior = None
    else:
        instance._estado_anterior = None


# =========================================================
# Al crear o actualizar un ticket: genera Historial y
# Notificación automáticamente.
# =========================================================
@receiver(post_save, sender=Ticket)
def registrar_historial_y_notificar(sender, instance, created, **kwargs):
    if created:
        # Avisa a quien debe atender el ticket: los admin_departamento
        # de ESE departamento, y todos los admin_global (RF-09). Así
        # no tienen que estar checando la lista para enterarse de que
        # llegó algo nuevo.
        admins = Usuario.objects.filter(
            Q(rol="admin_global")
            | Q(rol="admin_departamento", departamento=instance.departamento)
        )
        for admin in admins:
            Notificacion.objects.create(
                ticket=instance,
                usuario=admin,
                tipo=Notificacion.Tipo.CREADO,
                mensaje=(
                    f"Nuevo ticket #{instance.id} de {instance.creado_por}: "
                    f"“{instance.titulo}” ({instance.departamento})."
                ),
                enviado=True,
            )
        return

    estado_anterior = getattr(instance, "_estado_anterior", None)
    if estado_anterior and estado_anterior != instance.estado:
        # 1. Registrar en el historial (RF-08)
        HistorialTicket.objects.create(
            ticket=instance,
            usuario=instance.asignado_a or instance.creado_por,
            estado_anterior=estado_anterior,
            estado_nuevo=instance.estado,
        )

        # 2. Notificar al creador del ticket (RF-09)
        tipo = (
            Notificacion.Tipo.CERRADO
            if instance.estado == Ticket.Estado.CERRADO
            else Notificacion.Tipo.ACTUALIZADO
        )
        Notificacion.objects.create(
            ticket=instance,
            usuario=instance.creado_por,
            tipo=tipo,
            mensaje=f"Tu ticket #{instance.id} cambió de '{estado_anterior}' a '{instance.estado}'.",
            enviado=True,
        )


# =========================================================
# Al crear un Usuario nuevo, genera su Token de autenticación
# automáticamente (para que pueda usarlo en Postman/frontend).
# =========================================================
@receiver(post_save, sender=Usuario)
def crear_token_usuario(sender, instance, created, **kwargs):
    if created:
        Token.objects.get_or_create(user=instance)
