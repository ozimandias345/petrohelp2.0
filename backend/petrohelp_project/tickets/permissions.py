"""
Permisos de PetroHelp, basados en los 3 roles del sistema (RF-02):

- admin_global: ve y administra todo, pero NO crea tickets (el admin
  global no reporta incidencias, solo supervisa y da seguimiento).
- admin_departamento: solo puede ver/editar tickets de SU departamento.
- operador: solo puede ver/editar los tickets que ÉL creó, y NO puede
  cerrarlos (cerrar un ticket requiere admin_departamento o admin_global).
"""

from rest_framework import permissions


class TicketPermission(permissions.BasePermission):
    """
    Permiso a nivel de objeto para el modelo Ticket.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        # El admin_global no crea tickets: no tiene sentido que el
        # supervisor general reporte una incidencia sobre sí mismo.
        if request.method == "POST" and request.user.rol == "admin_global":
            return False

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Borrar tickets es una acción de limpieza/administración:
        # el operador puede editar/comentar los suyos, pero no borrarlos.
        if request.method == "DELETE":
            if user.rol == "admin_global":
                return True
            if user.rol == "admin_departamento":
                return obj.departamento_id == user.departamento_id
            return False

        # Admin global: acceso total (ver/editar/eliminar), pero
        # el has_permission de arriba ya le bloqueo crear.
        if user.rol == "admin_global":
            return True

        # Admin de departamento: solo tickets de su propio departamento
        if user.rol == "admin_departamento":
            return obj.departamento_id == user.departamento_id

        # Operador: solo los tickets que el mismo creo
        if user.rol == "operador":
            return obj.creado_por_id == user.id

        return False


class EsAdminGlobalOSoloLectura(permissions.BasePermission):
    """
    Para catalogos (Departamentos, Estaciones, Categorias):
    cualquier usuario autenticado puede consultarlos (GET),
    pero solo el admin_global puede crear/editar/borrar.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.rol == "admin_global"


class EsAdminGlobal(permissions.BasePermission):
    """
    Solo el admin_global puede gestionar usuarios del sistema.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.rol == "admin_global"
        )
