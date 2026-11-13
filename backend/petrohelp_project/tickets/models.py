"""
PetroHelp - Modelos de Django
Sistema Para Gestionar Incidencias en Gasolineras

Estos modelos representan la base de datos completa del sistema,
basados en los requerimientos funcionales (RF-01 a RF-10) del proyecto.
"""

from django.db import models
from django.contrib.auth.models import AbstractUser


# =========================================================
# DEPARTAMENTOS  (RF-04)
# =========================================================
class Departamento(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Departamento"
        verbose_name_plural = "Departamentos"

    def __str__(self):
        return self.nombre


# =========================================================
# ESTACIONES (Gasolineras)  (RF-03)
# =========================================================
class Estacion(models.Model):
    nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255, blank=True, null=True)
    activa = models.BooleanField(default=True)
    # Ubicación para el mapa de estaciones
    latitud = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        verbose_name = "Estación"
        verbose_name_plural = "Estaciones"

    def __str__(self):
        return self.nombre


# =========================================================
# CATEGORIAS  (RF-03, RF-04)
# Cada categoría pertenece a un departamento, para que el
# ticket se enrute automáticamente al seleccionarla.
# =========================================================
class Categoria(models.Model):
    nombre = models.CharField(max_length=100)
    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.PROTECT,
        related_name="categorias"
    )

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"
        unique_together = ("nombre", "departamento")

    def __str__(self):
        return f"{self.nombre} ({self.departamento})"


# =========================================================
# USUARIOS  (RF-01, RF-02, RF-10)
# Se extiende el usuario base de Django para aprovechar el
# manejo de contraseñas cifradas y autenticación integrada.
# =========================================================
class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        OPERADOR = "operador", "Operador"
        ADMIN_DEPARTAMENTO = "admin_departamento", "Administrador de Departamento"
        ADMIN_GLOBAL = "admin_global", "Administrador Global"

    rol = models.CharField(max_length=25, choices=Rol.choices, default=Rol.OPERADOR)
    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usuarios"
    )
    activo = models.BooleanField(default=True)  # activar/desactivar (RF-10)

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.rol})"


# =========================================================
# TICKETS  (RF-03, RF-05, RF-06)
# =========================================================
class Ticket(models.Model):
    class Prioridad(models.TextChoices):
        BAJA = "baja", "Baja"
        MEDIA = "media", "Media"
        ALTA = "alta", "Alta"

    class Estado(models.TextChoices):
        ABIERTO = "abierto", "Abierto"
        EN_PROCESO = "en_proceso", "En proceso"
        CERRADO = "cerrado", "Cerrado"

    titulo = models.CharField(max_length=150)
    descripcion = models.TextField()
    evidencia = models.ImageField(
        upload_to="evidencias/", null=True, blank=True
    )  # foto opcional del problema reportado

    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="tickets"
    )
    # Se guarda también el departamento directamente para consultas
    # rápidas (RF-05), aunque se derive de la categoría (RF-04).
    departamento = models.ForeignKey(
        Departamento, on_delete=models.PROTECT, related_name="tickets"
    )
    estacion = models.ForeignKey(
        Estacion, on_delete=models.PROTECT, related_name="tickets"
    )

    prioridad = models.CharField(
        max_length=10, choices=Prioridad.choices, default=Prioridad.MEDIA
    )
    estado = models.CharField(
        max_length=15, choices=Estado.choices, default=Estado.ABIERTO
    )

    creado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="tickets_creados"
    )
    asignado_a = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets_asignados"
    )

    fecha_registro = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Ticket"
        verbose_name_plural = "Tickets"
        ordering = ["-fecha_registro"]

    def __str__(self):
        return f"#{self.id} - {self.titulo} ({self.estado})"

    def save(self, *args, **kwargs):
        # Autocompleta el departamento según la categoría (RF-04)
        if self.categoria_id and not self.departamento_id:
            self.departamento = self.categoria.departamento
        super().save(*args, **kwargs)


# =========================================================
# COMENTARIOS / SEGUIMIENTO DE TICKETS  (RF-07)
# =========================================================
class ComentarioTicket(models.Model):
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="comentarios"
    )
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    comentario = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Comentario de Ticket"
        verbose_name_plural = "Comentarios de Tickets"
        ordering = ["fecha"]

    def __str__(self):
        return f"Comentario de {self.usuario} en ticket #{self.ticket_id}"


# =========================================================
# HISTORIAL DE CAMBIOS DE ESTADO  (RF-08)
# =========================================================
class HistorialTicket(models.Model):
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="historial"
    )
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    estado_anterior = models.CharField(max_length=15, choices=Ticket.Estado.choices)
    estado_nuevo = models.CharField(max_length=15, choices=Ticket.Estado.choices)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Historial de Ticket"
        verbose_name_plural = "Historial de Tickets"
        ordering = ["fecha"]

    def __str__(self):
        return f"Ticket #{self.ticket_id}: {self.estado_anterior} -> {self.estado_nuevo}"


# =========================================================
# NOTIFICACIONES INTERNAS  (RF-09)
# =========================================================
class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        CREADO = "creado", "Ticket creado"
        ACTUALIZADO = "actualizado", "Ticket actualizado"
        CERRADO = "cerrado", "Ticket cerrado"

    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="notificaciones"
    )
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE)
    tipo = models.CharField(max_length=15, choices=Tipo.choices)
    mensaje = models.CharField(max_length=255)
    enviado = models.BooleanField(default=False)
    leido = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ["-fecha"]

    def __str__(self):
        return f"[{self.tipo}] Ticket #{self.ticket_id} -> {self.usuario}"
