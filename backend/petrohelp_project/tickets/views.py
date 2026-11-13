from django.db.models import ProtectedError
from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
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
from .serializers import (
    DepartamentoSerializer,
    EstacionSerializer,
    CategoriaSerializer,
    UsuarioSerializer,
    TicketSerializer,
    ComentarioTicketSerializer,
    HistorialTicketSerializer,
    NotificacionSerializer,
)
from .permissions import TicketPermission, EsAdminGlobalOSoloLectura, EsAdminGlobal


class DepartamentoViewSet(viewsets.ModelViewSet):
    queryset = Departamento.objects.all().order_by("nombre")
    serializer_class = DepartamentoSerializer
    permission_classes = [EsAdminGlobalOSoloLectura]

    def destroy(self, request, *args, **kwargs):
        # Categoria y Ticket usan on_delete=PROTECT contra Departamento,
        # así que no se puede borrar uno que ya tenga categorías o
        # tickets asociados (se explica al admin en vez de un 500).
        depto = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        f"No se puede borrar «{depto.nombre}»: tiene categorías o "
                        "tickets asociados."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class EstacionViewSet(viewsets.ModelViewSet):
    queryset = Estacion.objects.all()
    serializer_class = EstacionSerializer
    permission_classes = [EsAdminGlobalOSoloLectura]


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.select_related("departamento").all()
    serializer_class = CategoriaSerializer
    permission_classes = [EsAdminGlobalOSoloLectura]

    def destroy(self, request, *args, **kwargs):
        # Ticket.categoria usa on_delete=PROTECT, así que no se puede
        # borrar una categoría que ya tenga tickets asociados.
        categoria = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        f"No se puede borrar «{categoria.nombre}»: tiene tickets "
                        "asociados."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.select_related("departamento").all()
    serializer_class = UsuarioSerializer
    permission_classes = [EsAdminGlobal]

    def destroy(self, request, *args, **kwargs):
        # Usuario.tickets_creados, comentarios e historial usan on_delete=PROTECT
        # (para no perder el rastro de auditoría), así que un usuario con
        # actividad no se puede borrar de verdad: se le explica al admin
        # que debe desactivarlo en su lugar.
        usuario = self.get_object()
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        f"No se puede borrar a «{usuario.username}»: tiene tickets, "
                        "comentarios o historial asociados. Desactívalo en su lugar "
                        "desde la columna Activo."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = [TicketPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["titulo", "descripcion"]
    ordering_fields = ["fecha_registro", "prioridad", "estado"]

    def get_queryset(self):
        """
        Cada rol ve un subconjunto distinto de tickets (RF-02):
        - admin_global: todos
        - admin_departamento: solo los de su departamento
        - operador: solo los que él creó
        """
        user = self.request.user
        base = Ticket.objects.select_related(
            "categoria", "departamento", "estacion", "creado_por"
        ).prefetch_related("comentarios", "historial")

        if not user.is_authenticated:
            return base.none()
        if user.rol == "admin_global":
            return base.all()
        if user.rol == "admin_departamento":
            return base.filter(departamento=user.departamento)
        return base.filter(creado_por=user)

    def perform_create(self, serializer):
        # El creador del ticket siempre es el usuario logueado,
        # nunca un valor que venga en el body de la petición.
        serializer.save(creado_por=self.request.user)


class ComentarioTicketViewSet(viewsets.ModelViewSet):
    queryset = ComentarioTicket.objects.select_related("usuario", "ticket").all()
    serializer_class = ComentarioTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class HistorialTicketViewSet(viewsets.ReadOnlyModelViewSet):
    # Solo lectura: el historial se genera solo, nadie lo captura a mano.
    queryset = HistorialTicket.objects.select_related("usuario", "ticket").all()
    serializer_class = HistorialTicketSerializer
    permission_classes = [permissions.IsAuthenticated]


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    # Solo lectura (salvo marcar_leida/marcar_todas_leidas): las
    # notificaciones las genera el sistema solo, vía señales.
    serializer_class = NotificacionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Cada quien ve solo las notificaciones dirigidas a él (es su
        # buzón personal, no un log global, ni para el admin_global).
        return (
            Notificacion.objects.select_related("usuario", "ticket")
            .filter(usuario=self.request.user)
        )

    @action(detail=True, methods=["post"])
    def marcar_leida(self, request, pk=None):
        notificacion = self.get_object()
        notificacion.leido = True
        notificacion.save(update_fields=["leido"])
        return Response(self.get_serializer(notificacion).data)

    @action(detail=False, methods=["post"])
    def marcar_todas_leidas(self, request):
        self.get_queryset().filter(leido=False).update(leido=True)
        return Response({"detail": "ok"})


from rest_framework.views import APIView


class MeView(APIView):
    """
    Devuelve los datos del usuario autenticado (a partir de su token).
    Lo usa el frontend justo despues del login para saber el rol.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data)
