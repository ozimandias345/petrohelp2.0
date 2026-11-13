from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Departamento,
    Estacion,
    Categoria,
    Usuario,
    Ticket,
    ComentarioTicket,
    HistorialTicket,
    Notificacion,
)


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("username", "email", "rol", "departamento", "activo", "is_staff")
    fieldsets = UserAdmin.fieldsets + (
        ("Información de PetroHelp", {"fields": ("rol", "departamento", "activo")}),
    )


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre")


@admin.register(Estacion)
class EstacionAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "direccion", "activa")


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "departamento")
    list_filter = ("departamento",)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "id", "titulo", "categoria", "departamento", "estacion",
        "prioridad", "estado", "creado_por", "fecha_registro",
    )
    list_filter = ("estado", "prioridad", "departamento")
    search_fields = ("titulo", "descripcion")


@admin.register(ComentarioTicket)
class ComentarioTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "usuario", "fecha")


@admin.register(HistorialTicket)
class HistorialTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "usuario", "estado_anterior", "estado_nuevo", "fecha")


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "usuario", "tipo", "enviado", "fecha")
