"""
URL configuration for petrohelp_backend project.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from rest_framework.authtoken.views import obtain_auth_token
from tickets.views import MeView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', obtain_auth_token),
    path('api/auth/me/', MeView.as_view()),
    path('api/', include('tickets.urls')),
]

# En desarrollo, Django sirve directamente las fotos de evidencia
# subidas (en producción esto lo haría el servidor web, no Django).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # En la nube (Render, plan gratis) no hay otro servidor web: Django
    # entrega las fotos. Ojo: ahí el disco se borra en cada reinicio.
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]
