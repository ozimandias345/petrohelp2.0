"""
Pruebas automáticas de PetroHelp.

Ejecutar:  python manage.py test
Revisan las reglas más importantes del sistema (roles, cierre de tickets,
historial, comentarios y usuarios desactivados).
"""
import tempfile
import zipfile
from pathlib import Path

from django.core.management import call_command
from rest_framework.test import APITestCase

from .models import Categoria, Departamento, Estacion, HistorialTicket, Ticket, Usuario


class PetroHelpTests(APITestCase):
    def setUp(self):
        self.depto = Departamento.objects.create(nombre="Mantenimiento")
        self.otro_depto = Departamento.objects.create(nombre="Sistemas")
        self.estacion = Estacion.objects.create(nombre="Estación 1")
        self.categoria = Categoria.objects.create(nombre="Bombas", departamento=self.depto)

        def usuario(nombre, rol, depto=None):
            u = Usuario(username=nombre, rol=rol, departamento=depto)
            u.set_password("Clave12345!")
            u.save()
            return u

        self.operador = usuario("operador1", "operador")
        self.operador2 = usuario("operador2", "operador")
        self.admin_depto = usuario("admin_mant", "admin_departamento", self.depto)
        self.admin_otro = usuario("admin_sis", "admin_departamento", self.otro_depto)
        self.admin_global = usuario("jefe", "admin_global")

    def crear_ticket(self, user=None):
        self.client.force_authenticate(user or self.operador)
        r = self.client.post("/api/tickets/", {
            "titulo": "Bomba 3 no despacha", "descripcion": "No sale combustible",
            "categoria": self.categoria.id, "estacion": self.estacion.id, "prioridad": "media",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data["id"]

    # ---------- Tickets ----------
    def test_ticket_se_enruta_al_departamento_de_la_categoria(self):
        t = Ticket.objects.get(pk=self.crear_ticket())
        self.assertEqual(t.departamento, self.depto)
        self.assertEqual(t.creado_por, self.operador)

    def test_admin_global_no_puede_crear_tickets(self):
        self.client.force_authenticate(self.admin_global)
        r = self.client.post("/api/tickets/", {
            "titulo": "x", "descripcion": "x", "categoria": self.categoria.id,
            "estacion": self.estacion.id, "prioridad": "baja",
        }, format="json")
        self.assertEqual(r.status_code, 403)

    def test_cada_rol_ve_solo_sus_tickets(self):
        tid = self.crear_ticket()
        for user, visibles in [(self.operador, 1), (self.operador2, 0), (self.admin_depto, 1),
                               (self.admin_otro, 0), (self.admin_global, 1)]:
            self.client.force_authenticate(user)
            self.assertEqual(len(self.client.get("/api/tickets/").data), visibles, user.username)
        self.client.force_authenticate(self.operador2)
        self.assertEqual(self.client.get(f"/api/tickets/{tid}/").status_code, 404)

    def test_operador_no_puede_cerrar(self):
        tid = self.crear_ticket()
        r = self.client.patch(f"/api/tickets/{tid}/", {"estado": "cerrado"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_no_se_cierra_sin_comentario(self):
        tid = self.crear_ticket()
        self.client.force_authenticate(self.admin_depto)
        r = self.client.patch(f"/api/tickets/{tid}/", {"estado": "cerrado"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_cierre_guarda_fecha_e_historial_con_el_usuario_correcto(self):
        tid = self.crear_ticket()
        self.client.force_authenticate(self.admin_depto)
        r = self.client.post("/api/comentarios/", {"ticket": tid, "comentario": "Se cambió la bomba"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        r = self.client.patch(f"/api/tickets/{tid}/", {"estado": "cerrado"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

        t = Ticket.objects.get(pk=tid)
        self.assertIsNotNone(t.fecha_cierre)
        h = HistorialTicket.objects.get(ticket=t)
        self.assertEqual((h.estado_anterior, h.estado_nuevo), ("abierto", "cerrado"))
        self.assertEqual(h.usuario, self.admin_depto)  # quien lo cerró, no quien lo creó

        # Al reabrirlo se limpia la fecha de cierre
        self.client.patch(f"/api/tickets/{tid}/", {"estado": "en_proceso"}, format="json")
        self.assertIsNone(Ticket.objects.get(pk=tid).fecha_cierre)

    def test_se_notifica_a_los_admins_al_crear(self):
        self.crear_ticket()
        self.client.force_authenticate(self.admin_depto)
        self.assertEqual(len(self.client.get("/api/notificaciones/").data), 1)
        self.client.force_authenticate(self.admin_otro)
        self.assertEqual(len(self.client.get("/api/notificaciones/").data), 0)

    # ---------- Comentarios ----------
    def test_no_se_puede_comentar_ni_leer_tickets_ajenos(self):
        tid = self.crear_ticket()
        self.client.post("/api/comentarios/", {"ticket": tid, "comentario": "hola"}, format="json")

        self.client.force_authenticate(self.operador2)
        r = self.client.post("/api/comentarios/", {"ticket": tid, "comentario": "intruso"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(self.client.get("/api/comentarios/").data), 0)
        self.assertEqual(len(self.client.get("/api/historial/").data), 0)

    def test_solo_el_autor_edita_su_comentario(self):
        tid = self.crear_ticket()
        cid = self.client.post("/api/comentarios/", {"ticket": tid, "comentario": "hola"}, format="json").data["id"]
        self.client.force_authenticate(self.admin_depto)
        r = self.client.patch(f"/api/comentarios/{cid}/", {"comentario": "cambiado"}, format="json")
        self.assertEqual(r.status_code, 403)

    # ---------- Usuarios ----------
    def test_usuario_desactivado_no_puede_entrar(self):
        datos = {"username": "operador1", "password": "Clave12345!"}
        self.assertEqual(self.client.post("/api/auth/login/", datos).status_code, 200)

        self.client.force_authenticate(self.admin_global)
        r = self.client.patch(f"/api/usuarios/{self.operador.id}/", {"activo": False}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/auth/login/", datos).status_code, 400)

    def test_crear_usuario_exige_contrasena_y_solo_admin_global(self):
        self.client.force_authenticate(self.admin_global)
        r = self.client.post("/api/usuarios/", {"username": "nuevo", "rol": "operador"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/usuarios/", {"username": "nuevo", "rol": "operador", "password": "Clave12345!"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)

        self.client.force_authenticate(self.admin_depto)
        self.assertEqual(self.client.get("/api/usuarios/").status_code, 403)

    # ---------- Reportes ----------
    def test_reportes_pdf_y_excel(self):
        self.crear_ticket()
        self.client.force_authenticate(self.admin_global)
        pdf = self.client.get("/api/reportes/incidencias/?formato=pdf&detalle=1")
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        xlsx = self.client.get("/api/reportes/incidencias/?formato=xlsx")
        self.assertEqual(xlsx.status_code, 200)
        self.assertTrue(xlsx.content.startswith(b"PK"))

    # ---------- Respaldos (DRP) ----------
    def test_respaldo_y_restauracion(self):
        tid = self.crear_ticket()
        with tempfile.TemporaryDirectory() as carpeta:
            call_command("respaldar", carpeta=carpeta, verbosity=0)
            archivos = list(Path(carpeta).glob("petrohelp_*.zip"))
            self.assertEqual(len(archivos), 1)
            with zipfile.ZipFile(archivos[0]) as z:
                self.assertIn("datos.json", z.namelist())

            # Desastre simulado: se pierde el ticket
            Ticket.objects.all().delete()
            self.assertFalse(Ticket.objects.exists())

            call_command("restaurar", str(archivos[0]), verbosity=0)
            self.assertTrue(Ticket.objects.filter(pk=tid, titulo="Bomba 3 no despacha").exists())
