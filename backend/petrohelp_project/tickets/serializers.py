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


class ComentarioTicketSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.username", read_only=True)

    class Meta:
        model = ComentarioTicket
        fields = ["id", "ticket", "usuario", "usuario_nombre", "comentario", "fecha"]
        read_only_fields = ["fecha", "usuario"]


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
