from django.contrib.auth.password_validation import validate_password as validar_contrasena
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
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


class DepartamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Departamento
        fields = "__all__"


class EstacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estacion
        fields = "__all__"


class CategoriaSerializer(serializers.ModelSerializer):
    departamento_nombre = serializers.CharField(source="departamento.nombre", read_only=True)

    class Meta:
        model = Categoria
        fields = ["id", "nombre", "departamento", "departamento_nombre"]


class UsuarioSerializer(serializers.ModelSerializer):
    departamento_nombre = serializers.CharField(source="departamento.nombre", read_only=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Usuario
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "rol", "departamento", "departamento_nombre", "activo", "password",
        ]

    def validate(self, data):
        if self.instance is None and not data.get("password"):
            raise serializers.ValidationError(
                {"password": "La contraseña es obligatoria al crear un usuario."}
            )
        return data

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = Usuario(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RegistroSerializer(serializers.Serializer):
    """
    Alta publica de cuentas desde la pantalla de inicio de sesion.

    Siempre crea usuarios con rol OPERADOR. El rol no se puede elegir
    desde aqui aunque venga en la peticion: asi nadie puede darse de
    alta como administrador.
    """
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    def validate_username(self, valor):
        valor = (valor or "").strip()
        if not valor:
            raise serializers.ValidationError("Escribe un nombre de usuario.")
        if Usuario.objects.filter(username__iexact=valor).exists():
            raise serializers.ValidationError("Ese nombre de usuario ya esta ocupado.")
        return valor

    def validate(self, data):
        if data.get("password") != data.get("password2"):
            raise serializers.ValidationError(
                {"password2": "Las dos contrasenas no coinciden."}
            )
        try:
            validar_contrasena(data.get("password"))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data

    def create(self, validated_data):
        validated_data.pop("password2", None)
        usuario = Usuario(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            rol=Usuario.Rol.OPERADOR,   # fijo
            activo=True,
            is_staff=False,
            is_superuser=False,
        )
        usuario.set_password(validated_data["password"])
        usuario.save()
        return usuario


class SolicitarCodigoSerializer(serializers.Serializer):
    """Paso 1: la persona escribe su correo y le mandamos un codigo."""
    email = serializers.EmailField()


class RestablecerSerializer(serializers.Serializer):
    """Paso 2: codigo recibido por correo mas la contrasena nueva."""
    email = serializers.EmailField()
    codigo = serializers.CharField(max_length=10)
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    def validate(self, data):
        if data.get("password") != data.get("password2"):
            raise serializers.ValidationError(
                {"password2": "Las dos contrasenas no coinciden."}
            )
        try:
            validar_contrasena(data.get("password"))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data


class ComentarioTicketSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.username", read_only=True)

    class Meta:
        model = ComentarioTicket
        fields = ["id", "ticket", "usuario", "usuario_nombre", "comentario", "fecha"]
        read_only_fields = ["fecha", "usuario"]

    def validate_ticket(self, ticket):
        # Solo se puede comentar en tickets que el usuario puede ver.
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return ticket
        permitido = (
            user.rol == "admin_global"
            or (user.rol == "admin_departamento" and ticket.departamento_id == user.departamento_id)
            or ticket.creado_por_id == user.id
        )
        if not permitido:
            raise serializers.ValidationError("No tienes acceso a este ticket.")
        if self.instance is not None and self.instance.ticket_id != ticket.id:
            raise serializers.ValidationError("No se puede mover un comentario a otro ticket.")
        return ticket


class HistorialTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = HistorialTicket
        fields = "__all__"
        read_only_fields = ["fecha"]


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = "__all__"
        read_only_fields = ["fecha"]


class TicketSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    departamento_nombre = serializers.CharField(source="departamento.nombre", read_only=True)
    estacion_nombre = serializers.CharField(source="estacion.nombre", read_only=True)
    creado_por_nombre = serializers.CharField(source="creado_por.username", read_only=True)

    comentarios = ComentarioTicketSerializer(many=True, read_only=True)
    historial = HistorialTicketSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id", "titulo", "descripcion", "evidencia",
            "categoria", "categoria_nombre",
            "departamento", "departamento_nombre",
            "estacion", "estacion_nombre",
            "prioridad", "estado",
            "creado_por", "creado_por_nombre", "asignado_a",
            "fecha_registro", "fecha_actualizacion", "fecha_cierre",
            "comentarios", "historial",
        ]
        read_only_fields = [
            "departamento", "creado_por",
            "fecha_registro", "fecha_actualizacion", "fecha_cierre",
        ]

    def validate(self, data):
        """
        Reglas de negocio al cambiar el estado de un ticket:

        1. Solo admin_departamento o admin_global pueden CERRAR un
           ticket. El operador puede crearlo y darle seguimiento,
           pero no puede cerrarlo el mismo (RF-06).
        2. No se puede cerrar un ticket que no tiene ningun
           comentario de seguimiento (RF-07 + RF-06).
        """
        estado_nuevo = data.get("estado")

        if estado_nuevo == Ticket.Estado.CERRADO and self.instance:
            request = self.context.get("request")
            user = getattr(request, "user", None)

            if user and user.rol == "operador":
                raise serializers.ValidationError(
                    "Un operador no puede cerrar tickets. Solo un "
                    "administrador de departamento o global puede hacerlo."
                )

            if not self.instance.comentarios.exists():
                raise serializers.ValidationError(
                    "No se puede cerrar un ticket que no tiene "
                    "ningun comentario de seguimiento."
                )

        return data
