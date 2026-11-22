from django.db.models import ProtectedError
from rest_framework import viewsets, filters, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    CodigoRecuperacion,
    Departamento,
    Estacion,
    Categoria,
    Usuario,
    Ticket,
    ComentarioTicket,
    HistorialTicket,
    Notificacion,
)
import secrets
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.throttling import ScopedRateThrottle
from .serializers import (
    RegistroSerializer,
    SolicitarCodigoSerializer,
    RestablecerSerializer,
    CambiarPasswordSerializer,
    MiPerfilSerializer,
    DepartamentoSerializer,
    EstacionSerializer,
    CategoriaSerializer,
    UsuarioSerializer,
    TicketSerializer,
    ComentarioTicketSerializer,
    HistorialTicketSerializer,
    NotificacionSerializer,
)
from .permissions import (
    TicketPermission,
    EsAdminGlobalOSoloLectura,
    EsAdminGlobal,
    EsAdminGlobalOJefeSoloLectura,
)


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
    queryset = Usuario.objects.select_related("departamento", "estacion").all()
    serializer_class = UsuarioSerializer
    permission_classes = [EsAdminGlobalOJefeSoloLectura]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # El jefe de departamento solo ve a la gente de su propia area.
        if user.rol == "admin_departamento":
            return qs.filter(departamento_id=user.departamento_id)
        return qs

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
        ).prefetch_related("comentarios__usuario", "historial")

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

    def perform_update(self, serializer):
        # Para que el historial registre quién cambió el estado de verdad
        # (antes siempre quedaba a nombre del creador del ticket).
        serializer.instance._usuario_cambio = self.request.user
        serializer.save()


def _solo_tickets_visibles(qs, user):
    """Limita comentarios/historial a los tickets que el usuario puede ver."""
    if user.rol == "admin_global":
        return qs
    if user.rol == "admin_departamento":
        return qs.filter(ticket__departamento=user.departamento)
    return qs.filter(ticket__creado_por=user)


class ComentarioTicketViewSet(viewsets.ModelViewSet):
    queryset = ComentarioTicket.objects.select_related("usuario", "ticket").all()
    serializer_class = ComentarioTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Antes cualquier usuario podía leer los comentarios de todos los tickets.
        return _solo_tickets_visibles(super().get_queryset(), self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.usuario_id != self.request.user.id:
            raise PermissionDenied("Solo puedes editar tus propios comentarios.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.usuario_id != self.request.user.id and self.request.user.rol != "admin_global":
            raise PermissionDenied("Solo puedes borrar tus propios comentarios.")
        instance.delete()


class HistorialTicketViewSet(viewsets.ReadOnlyModelViewSet):
    # Solo lectura: el historial se genera solo, nadie lo captura a mano.
    queryset = HistorialTicket.objects.select_related("usuario", "ticket").all()
    serializer_class = HistorialTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _solo_tickets_visibles(super().get_queryset(), self.request.user)


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

    def patch(self, request):
        """Cada quien puede corregir su nombre y su correo, nada mas."""
        serializer = MiPerfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UsuarioSerializer(request.user).data)


class RegistroView(APIView):
    """
    Alta publica de cuentas desde la pantalla de inicio de sesion.

    Solo crea usuarios con rol "operador": quien se registra aqui puede
    reportar incidencias y ver las suyas, nada mas. Devuelve el token
    para que entre de inmediato, sin tener que escribir sus datos otra vez.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registro"

    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        token, _ = Token.objects.get_or_create(user=usuario)
        return Response(
            {"token": token.key, "usuario": UsuarioSerializer(usuario).data},
            status=status.HTTP_201_CREATED,
        )


# =========================================================
# RECUPERAR CONTRASENA POR CODIGO AL CORREO
# =========================================================
MAX_INTENTOS_CODIGO = 5

# Respuesta unica para el paso 1: no decimos si el correo existe o no,
# para que nadie pueda averiguar que cuentas hay en el sistema.
RESPUESTA_GENERICA = {
    "detail": "Si ese correo pertenece a una cuenta, enviamos un codigo de 6 digitos. "
              "Revisa tu bandeja y la carpeta de spam."
}


class SolicitarCodigoView(APIView):
    """Paso 1: genera un codigo de 6 digitos y lo manda al correo."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "codigo"

    def post(self, request):
        serializer = SolicitarCodigoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correo = serializer.validated_data["email"].strip()

        usuario = Usuario.objects.filter(email__iexact=correo, activo=True).first()
        if usuario:
            # Un codigo a la vez: los anteriores dejan de servir.
            CodigoRecuperacion.objects.filter(usuario=usuario, usado=False).update(usado=True)

            codigo = f"{secrets.randbelow(1000000):06d}"
            minutos = getattr(settings, "CODIGO_VIGENCIA_MINUTOS", 15)
            CodigoRecuperacion.objects.create(
                usuario=usuario,
                codigo_hash=make_password(codigo),
                expira=timezone.now() + timezone.timedelta(minutes=minutos),
            )

            nombre = usuario.first_name or usuario.username
            cuerpo = (
                f"Hola {nombre}:\n\n"
                f"Tu codigo para restablecer la contrasena de PetroHelp es:\n\n"
                f"        {codigo}\n\n"
                f"Vence en {minutos} minutos y solo se puede usar una vez.\n\n"
                f"Si no pediste cambiar tu contrasena, ignora este mensaje: "
                f"tu cuenta sigue igual.\n\n"
                f"PetroHelp - Gestion preventiva para gasolineras"
            )
            try:
                send_mail(
                    subject="Tu codigo de PetroHelp",
                    message=cuerpo,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[usuario.email],
                    fail_silently=False,
                )
            except Exception:
                # El correo fallo (credenciales, red). No se lo contamos a
                # quien pregunta, pero queda en el log del servidor.
                import logging
                logging.getLogger(__name__).exception("No se pudo enviar el codigo")

        return Response(RESPUESTA_GENERICA, status=status.HTTP_200_OK)


class RestablecerView(APIView):
    """Paso 2: valida el codigo y guarda la contrasena nueva."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "codigo"

    def post(self, request):
        serializer = RestablecerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        error = {"detail": "El codigo no es valido o ya vencio. Pide uno nuevo."}

        usuario = Usuario.objects.filter(email__iexact=datos["email"].strip(), activo=True).first()
        if not usuario:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        registro = (
            CodigoRecuperacion.objects
            .filter(usuario=usuario, usado=False)
            .order_by("-creado")
            .first()
        )
        if not registro or registro.vencido:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        if registro.intentos >= MAX_INTENTOS_CODIGO:
            registro.usado = True
            registro.save(update_fields=["usado"])
            return Response(
                {"detail": "Demasiados intentos fallidos. Pide un codigo nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_password(datos["codigo"].strip(), registro.codigo_hash):
            registro.intentos += 1
            registro.save(update_fields=["intentos"])
            restantes = MAX_INTENTOS_CODIGO - registro.intentos
            return Response(
                {"detail": f"Codigo incorrecto. Te quedan {restantes} intentos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        usuario.set_password(datos["password"])
        usuario.save()
        registro.usado = True
        registro.save(update_fields=["usado"])

        # Cerrar las sesiones abiertas: si alguien mas tenia el token, deja de servir.
        Token.objects.filter(user=usuario).delete()

        return Response(
            {"detail": "Listo, tu contrasena se actualizo. Ya puedes iniciar sesion."},
            status=status.HTTP_200_OK,
        )


class CambiarPasswordView(APIView):
    """
    Cambio de contrasena desde el perfil, pidiendo la actual.

    Al terminar se renueva el token: las sesiones abiertas en otros
    dispositivos dejan de servir y se devuelve el token nuevo para que
    quien hizo el cambio siga trabajando sin volver a entrar.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CambiarPasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        usuario = request.user
        usuario.set_password(serializer.validated_data["nueva"])
        usuario.save()

        Token.objects.filter(user=usuario).delete()
        token = Token.objects.create(user=usuario)

        return Response(
            {"detail": "Tu contrasena se actualizo.", "token": token.key},
            status=status.HTTP_200_OK,
        )
