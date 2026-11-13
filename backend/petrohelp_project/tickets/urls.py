from django.urls import path
from rest_framework.routers import DefaultRouter
from .reportes import ReporteIncidenciasView
from .views import (
    DepartamentoViewSet,
    EstacionViewSet,
    CategoriaViewSet,
    UsuarioViewSet,
    TicketViewSet,
    ComentarioTicketViewSet,
    HistorialTicketViewSet,
    NotificacionViewSet,
)

router = DefaultRouter()
router.register(r"departamentos", DepartamentoViewSet)
router.register(r"estaciones", EstacionViewSet)
router.register(r"categorias", CategoriaViewSet)
router.register(r"usuarios", UsuarioViewSet)
router.register(r"tickets", TicketViewSet, basename="ticket")
router.register(r"comentarios", ComentarioTicketViewSet)
router.register(r"historial", HistorialTicketViewSet)
router.register(r"notificaciones", NotificacionViewSet, basename="notificacion")

urlpatterns = router.urls + [
    # Reportes exportables (PDF / Excel)
    path("reportes/incidencias/", ReporteIncidenciasView.as_view()),
]
