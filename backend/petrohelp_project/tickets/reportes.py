"""
PetroHelp - Reportes exportables (PDF y Excel)

Bitácora de incidencias para auditorías internas y de la ASEA (SASISOPA):
resumen, listado de tickets y, opcionalmente, historial de cambios de
estado y comentarios de seguimiento.

Endpoint:
    GET /api/reportes/incidencias/?formato=pdf|xlsx
        &desde=AAAA-MM-DD &hasta=AAAA-MM-DD
        &estacion=<id> &departamento=<id> &estado=<estado> &prioridad=<prioridad>
        &detalle=1   (incluye historial y comentarios)

Respeta los permisos de cada rol (igual que la lista de tickets):
admin_global ve todo, admin_departamento su departamento, operador lo suyo.
"""
from datetime import datetime, time
from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Ticket

AMARILLO = "#FFC400"
NEGRO = "#111111"
ROJO = "#D92D20"
NARANJA = "#E08A1E"
VERDE = "#1F9D63"

ESTADOS = {"abierto": "Abierto", "en_proceso": "En proceso", "cerrado": "Cerrado"}
PRIORIDADES = {"alta": "Alta", "media": "Media", "baja": "Baja"}
COLOR_PRIORIDAD = {"alta": ROJO, "media": NARANJA, "baja": VERDE}
COLOR_ESTADO = {"abierto": ROJO, "en_proceso": NARANJA, "cerrado": VERDE}


# =========================================================
# Datos
# =========================================================
def tickets_visibles(user):
    """Mismo criterio de visibilidad que TicketViewSet.get_queryset."""
    base = Ticket.objects.select_related(
        "categoria", "departamento", "estacion", "creado_por", "asignado_a"
    ).prefetch_related("comentarios__usuario", "historial__usuario")
    if user.rol == "admin_global":
        return base.all()
    if user.rol == "admin_departamento":
        return base.filter(departamento=user.departamento)
    return base.filter(creado_por=user)


def _fecha(valor):
    if not valor:
        return None
    return datetime.strptime(valor, "%Y-%m-%d").date()


def _local(dt):
    return timezone.localtime(dt) if dt else None


def _dias(t):
    """Días que tardó en cerrarse (o lleva abierto)."""
    fin = t.fecha_cierre or timezone.now()
    return round((fin - t.fecha_registro).total_seconds() / 86400, 1)


def armar_datos(user, params) -> dict:
    """Convierte los tickets filtrados a estructuras simples (dicts)."""
    qs = tickets_visibles(user)
    desde, hasta = _fecha(params.get("desde")), _fecha(params.get("hasta"))
    tz = timezone.get_current_timezone()
    if desde:
        qs = qs.filter(fecha_registro__gte=timezone.make_aware(datetime.combine(desde, time.min), tz))
    if hasta:
        qs = qs.filter(fecha_registro__lte=timezone.make_aware(datetime.combine(hasta, time.max), tz))
    for campo in ("estacion", "departamento"):
        if params.get(campo):
            qs = qs.filter(**{f"{campo}_id": params[campo]})
    for campo in ("estado", "prioridad"):
        if params.get(campo):
            qs = qs.filter(**{campo: params[campo]})
    qs = qs.order_by("fecha_registro")

    filas = []
    for t in qs:
        filas.append({
            "id": t.id,
            "fecha": _local(t.fecha_registro),
            "titulo": t.titulo,
            "descripcion": t.descripcion,
            "estacion": t.estacion.nombre,
            "categoria": t.categoria.nombre,
            "departamento": t.departamento.nombre,
            "prioridad": t.prioridad,
            "estado": t.estado,
            "creado_por": t.creado_por.get_full_name() or t.creado_por.username,
            "asignado_a": (t.asignado_a.get_full_name() or t.asignado_a.username) if t.asignado_a else "",
            "fecha_cierre": _local(t.fecha_cierre),
            "dias": _dias(t),
            "historial": [
                {"fecha": _local(h.fecha), "usuario": h.usuario.username,
                 "de": h.estado_anterior, "a": h.estado_nuevo}
                for h in t.historial.all()
            ],
            "comentarios": [
                {"fecha": _local(c.fecha), "usuario": c.usuario.username, "texto": c.comentario}
                for c in t.comentarios.all()
            ],
        })

    filtros = []
    if desde or hasta:
        filtros.append(f"Periodo: {desde.strftime('%d/%m/%Y') if desde else 'inicio'} – "
                       f"{hasta.strftime('%d/%m/%Y') if hasta else 'hoy'}")
    if params.get("estacion") and filas:
        filtros.append(f"Estación: {filas[0]['estacion']}")
    if params.get("departamento") and filas:
        filtros.append(f"Departamento: {filas[0]['departamento']}")
    if params.get("estado"):
        filtros.append(f"Estado: {ESTADOS.get(params['estado'], params['estado'])}")
    if params.get("prioridad"):
        filtros.append(f"Prioridad: {PRIORIDADES.get(params['prioridad'], params['prioridad'])}")

    alcance = {
        "admin_global": "Todas las estaciones y departamentos",
        "admin_departamento": f"Departamento: {getattr(user.departamento, 'nombre', '—')}",
        "operador": "Tickets registrados por el usuario",
    }.get(user.rol, "")

    return {
        "tickets": filas,
        "filtros": filtros or ["Sin filtros (todo el historial)"],
        "alcance": alcance,
        "generado_por": user.get_full_name() or user.username,
        "generado_en": timezone.localtime(),
        "detalle": params.get("detalle") in ("1", "true", "si"),
    }


def resumen(tickets: list[dict]) -> dict:
    cerrados = [t for t in tickets if t["estado"] == "cerrado"]
    por = lambda clave, valor: sum(1 for t in tickets if t[clave] == valor)  # noqa: E731
    estaciones = {}
    for t in tickets:
        estaciones[t["estacion"]] = estaciones.get(t["estacion"], 0) + 1
    return {
        "total": len(tickets),
        "abierto": por("estado", "abierto"),
        "en_proceso": por("estado", "en_proceso"),
        "cerrado": len(cerrados),
        "alta": por("prioridad", "alta"),
        "media": por("prioridad", "media"),
        "baja": por("prioridad", "baja"),
        "promedio_cierre": round(sum(t["dias"] for t in cerrados) / len(cerrados), 1) if cerrados else None,
        "por_estacion": sorted(estaciones.items(), key=lambda x: -x[1]),
    }


def _f(dt, con_hora=True):
    if not dt:
        return ""
    return dt.strftime("%d/%m/%Y %H:%M" if con_hora else "%d/%m/%Y")


# =========================================================
# PDF (reportlab)
# =========================================================
def generar_pdf(datos: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    C = colors.HexColor
    buf = BytesIO()
    ancho, alto = landscape(letter)
    est = getSampleStyleSheet()
    s_norm = ParagraphStyle("n", parent=est["Normal"], fontName="Helvetica", fontSize=8.5, leading=11)
    s_peq = ParagraphStyle("p", parent=s_norm, fontSize=7.5, leading=9.5, textColor=C("#4B4B4F"))
    s_h2 = ParagraphStyle("h2", parent=s_norm, fontName="Helvetica-Bold", fontSize=12, leading=15, spaceBefore=6, spaceAfter=6)
    s_cel = ParagraphStyle("c", parent=s_norm, fontSize=7.8, leading=9.6)
    s_der = ParagraphStyle("d", parent=s_peq, alignment=TA_RIGHT)

    def logo(c, x, y, s):
        """Dibuja el logo (señal en rombo con bomba) con centro en x,y y tamaño s."""
        h = s / 2
        c.saveState()
        c.setFillColor(C(AMARILLO)); c.setStrokeColor(C(NEGRO)); c.setLineWidth(s * 0.05); c.setLineJoin(1)
        p = c.beginPath(); p.moveTo(x, y + h); p.lineTo(x + h, y); p.lineTo(x, y - h); p.lineTo(x - h, y); p.close()
        c.drawPath(p, fill=1, stroke=1)
        i = h * 0.8; c.setLineWidth(s * 0.02)
        p = c.beginPath(); p.moveTo(x, y + i); p.lineTo(x + i, y); p.lineTo(x, y - i); p.lineTo(x - i, y); p.close()
        c.drawPath(p, fill=0, stroke=1)
        u = s / 120  # mismas proporciones que el SVG (viewBox 120)
        c.setFillColor(C(NEGRO))
        c.roundRect(x - 13 * u, y - 14 * u, 20 * u, 32 * u, 3 * u, fill=1, stroke=0)
        c.roundRect(x - 16 * u, y - 18 * u, 26 * u, 5 * u, 1.5 * u, fill=1, stroke=0)
        c.setFillColor(C(AMARILLO)); c.roundRect(x - 9.5 * u, y + 6 * u, 13 * u, 8 * u, 1.5 * u, fill=1, stroke=0)
        c.setStrokeColor(C(NEGRO)); c.setLineWidth(3.5 * u); c.setLineCap(1)
        p = c.beginPath(); p.moveTo(x + 7 * u, y + 9 * u); p.lineTo(x + 11 * u, y + 9 * u)
        p.lineTo(x + 14 * u, y + 6 * u); p.lineTo(x + 14 * u, y - 6 * u); p.lineTo(x + 21 * u, y - 6 * u)
        p.lineTo(x + 21 * u, y + 7 * u); p.lineTo(x + 18 * u, y + 11 * u)
        c.drawPath(p, fill=0, stroke=1)
        c.restoreState()

    def decorar(c, doc):
        c.saveState()
        # Franja de precaución
        paso = 10
        c.setFillColor(C(NEGRO)); c.rect(0, alto - 8, ancho, 8, fill=1, stroke=0)
        c.setFillColor(C(AMARILLO))
        for xx in range(-20, int(ancho) + 20, paso * 2):
            p = c.beginPath(); p.moveTo(xx, alto); p.lineTo(xx + paso, alto); p.lineTo(xx + paso + 8, alto - 8); p.lineTo(xx + 8, alto - 8); p.close()
            c.drawPath(p, fill=1, stroke=0)
        # Encabezado
        logo(c, 18 * mm, alto - 22 * mm, 16 * mm)
        c.setFillColor(C(NEGRO)); c.setFont("Helvetica-Bold", 16); c.drawString(29 * mm, alto - 21 * mm, "Petro")
        c.setFillColor(C("#E6AC00")); c.drawString(29 * mm + c.stringWidth("Petro", "Helvetica-Bold", 16), alto - 21 * mm, "Help")
        c.setFillColor(C("#8A8A90")); c.setFont("Helvetica", 8); c.drawString(29 * mm, alto - 25.5 * mm, "Prevenimos antes de que pase")
        c.setFillColor(C(NEGRO)); c.setFont("Helvetica-Bold", 13)
        c.drawRightString(ancho - 14 * mm, alto - 20 * mm, "Reporte de incidencias")
        c.setFont("Helvetica", 8); c.setFillColor(C("#4B4B4F"))
        c.drawRightString(ancho - 14 * mm, alto - 25 * mm, f"Generado el {_f(datos['generado_en'])} por {datos['generado_por']}")
        c.setStrokeColor(C("#E7E7EA")); c.setLineWidth(0.8); c.line(14 * mm, alto - 30 * mm, ancho - 14 * mm, alto - 30 * mm)
        # Pie
        c.setFont("Helvetica", 7.5); c.setFillColor(C("#8A8A90"))
        c.drawString(14 * mm, 9 * mm, "Documento generado por PetroHelp · Bitácora de incidencias para control interno y auditoría (SASISOPA)")
        c.drawRightString(ancho - 14 * mm, 9 * mm, f"Página {doc.page}")
        c.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=landscape(letter), leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=35 * mm, bottomMargin=16 * mm, title="Reporte de incidencias - PetroHelp", author="PetroHelp",
    )
    T = datos["tickets"]; R = resumen(T)
    hist = []

    # --- Alcance y filtros
    hist.append(Paragraph(f"<b>Alcance:</b> {datos['alcance']} &nbsp;&nbsp;·&nbsp;&nbsp; <b>Filtros:</b> {' · '.join(datos['filtros'])}", s_peq))
    hist.append(Spacer(1, 6))

    # --- Tarjetas de resumen
    def tarjeta(titulo, valor, color):
        return [Paragraph(f'<font size="7" color="#8A8A90">{titulo.upper()}</font>', s_norm),
                Paragraph(f'<font size="20" color="{color}"><b>{valor}</b></font>', ParagraphStyle("v", parent=s_norm, leading=24))]
    prom = f"{R['promedio_cierre']} días" if R["promedio_cierre"] is not None else "—"
    celdas = [tarjeta("Total", R["total"], NEGRO), tarjeta("Abiertos", R["abierto"], ROJO),
              tarjeta("En proceso", R["en_proceso"], NARANJA), tarjeta("Cerrados", R["cerrado"], VERDE),
              tarjeta("Prioridad alta", R["alta"], ROJO), tarjeta("Tiempo prom. de cierre", prom, NEGRO)]
    tab = Table([celdas], colWidths=[(ancho - 28 * mm) / 6] * 6)
    tab.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, C("#E7E7EA")), ("INNERGRID", (0, 0), (-1, -1), 0.6, C("#E7E7EA")),
        ("LINEABOVE", (0, 0), (-1, 0), 2.5, C(AMARILLO)),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ]))
    hist += [tab, Spacer(1, 6)]
    if R["por_estacion"]:
        top = " · ".join(f"{n}: <b>{c}</b>" for n, c in R["por_estacion"][:6])
        hist.append(Paragraph(f"<b>Incidencias por estación:</b> {top}", s_peq))
    hist.append(Spacer(1, 8))

    # --- Tabla de tickets
    hist.append(Paragraph("Listado de incidencias", s_h2))
    if not T:
        hist.append(Paragraph("No hay incidencias con los filtros seleccionados.", s_norm))
    else:
        enc = ["#", "Fecha", "Estación", "Categoría / Depto.", "Título", "Prioridad", "Estado", "Reportó", "Cierre", "Días"]
        filas = [[Paragraph(f"<b>{h}</b>", s_cel) for h in enc]]
        for t in T:
            filas.append([
                Paragraph(str(t["id"]), s_cel), Paragraph(_f(t["fecha"]), s_cel), Paragraph(t["estacion"], s_cel),
                Paragraph(f"{t['categoria']}<br/><font color='#8A8A90'>{t['departamento']}</font>", s_cel),
                Paragraph(t["titulo"], s_cel),
                Paragraph(f"<font color='{COLOR_PRIORIDAD.get(t['prioridad'], NEGRO)}'><b>{PRIORIDADES.get(t['prioridad'], t['prioridad'])}</b></font>", s_cel),
                Paragraph(f"<font color='{COLOR_ESTADO.get(t['estado'], NEGRO)}'><b>{ESTADOS.get(t['estado'], t['estado'])}</b></font>", s_cel),
                Paragraph(t["creado_por"], s_cel), Paragraph(_f(t["fecha_cierre"], False) or "—", s_cel),
                Paragraph(str(t["dias"]), s_cel),
            ])
        anchos = [10, 26, 32, 38, 59, 20, 25, 25, 20, 11]
        total_mm = sum(anchos); disp = (ancho - 28 * mm)
        tab = Table(filas, colWidths=[a / total_mm * disp for a in anchos], repeatRows=1)
        tab.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), C(AMARILLO)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C("#F7F7F8")]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, C("#E7E7EA")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        hist.append(tab)

    # --- Detalle (bitácora por ticket)
    if datos["detalle"] and T:
        hist.append(Spacer(1, 10))
        hist.append(Paragraph("Bitácora detallada por incidencia", s_h2))
        for t in T:
            bloque = [Paragraph(
                f"<b>#{t['id']} · {t['titulo']}</b> &nbsp;<font color='#8A8A90'>{t['estacion']} · {_f(t['fecha'])} · "
                f"{PRIORIDADES.get(t['prioridad'], '')} · {ESTADOS.get(t['estado'], '')}</font>", s_norm),
                Paragraph(t["descripcion"].replace("\n", "<br/>"), s_peq)]
            eventos = [(h["fecha"], f"<b>{h['usuario']}</b> cambió el estado de {ESTADOS.get(h['de'], h['de'])} a "
                        f"<b>{ESTADOS.get(h['a'], h['a'])}</b>") for h in t["historial"]]
            eventos += [(c["fecha"], f"<b>{c['usuario']}</b> comentó: {c['texto']}") for c in t["comentarios"]]
            eventos.sort(key=lambda e: e[0])
            if eventos:
                filas = [[Paragraph(_f(f), s_peq), Paragraph(txt.replace("\n", "<br/>"), s_peq)] for f, txt in eventos]
                tb = Table(filas, colWidths=[30 * mm, ancho - 28 * mm - 34 * mm])
                tb.setStyle(TableStyle([("LINEBEFORE", (0, 0), (0, -1), 2, C(AMARILLO)), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
                bloque += [Spacer(1, 3), tb]
            else:
                bloque.append(Paragraph("<i>Sin seguimiento registrado.</i>", s_peq))
            bloque.append(Spacer(1, 8))
            hist.append(KeepTogether(bloque))

    # --- Firmas
    hist.append(Spacer(1, 22))
    w = (ancho - 28 * mm - 2 * 18 * mm) / 3
    firmas = Table([["", "", "", "", ""], ["Elaboró", "", "Revisó", "", "Responsable SASISOPA"]],
                   colWidths=[w, 18 * mm, w, 18 * mm, w], rowHeights=[30, 18])
    firmas.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (0, 1), 0.8, C(NEGRO)), ("LINEABOVE", (2, 1), (2, 1), 0.8, C(NEGRO)),
        ("LINEABOVE", (4, 1), (4, 1), 0.8, C(NEGRO)), ("ALIGN", (0, 1), (-1, 1), "CENTER"),
        ("VALIGN", (0, 1), (-1, 1), "BOTTOM"),
        ("FONTSIZE", (0, 1), (-1, 1), 8), ("TEXTCOLOR", (0, 1), (-1, 1), C("#4B4B4F")),
    ]))
    hist.append(KeepTogether([firmas]))

    doc.build(hist, onFirstPage=decorar, onLaterPages=decorar)
    return buf.getvalue()


# =========================================================
# Excel (openpyxl)
# =========================================================
def generar_xlsx(datos: dict) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    T = datos["tickets"]; R = resumen(T)
    wb = Workbook()
    amarillo = PatternFill("solid", fgColor="FFC400")
    negro = PatternFill("solid", fgColor="111111")
    gris = PatternFill("solid", fgColor="F7F7F8")
    borde = Border(bottom=Side(style="thin", color="E7E7EA"))
    color = {"alta": "D92D20", "media": "E08A1E", "baja": "1F9D63",
             "abierto": "D92D20", "en_proceso": "E08A1E", "cerrado": "1F9D63"}

    def encabezado(ws, columnas, anchos):
        ws.append(columnas)
        for i, a in enumerate(anchos, start=1):
            c = ws.cell(row=ws.max_row, column=i)
            c.fill = amarillo; c.font = Font(bold=True, color="111111")
            c.alignment = Alignment(vertical="center", wrap_text=True)
            ws.column_dimensions[get_column_letter(i)].width = a
        ws.freeze_panes = ws.cell(row=ws.max_row + 1, column=1)
        ws.auto_filter.ref = f"A{ws.max_row}:{get_column_letter(len(columnas))}{ws.max_row}"
        return ws.max_row

    # --- Hoja Resumen
    ws = wb.active; ws.title = "Resumen"
    ws["A1"] = "PetroHelp · Reporte de incidencias"; ws["A1"].font = Font(bold=True, size=16, color="FFFFFF")
    ws["A1"].fill = negro; ws.merge_cells("A1:D1"); ws.row_dimensions[1].height = 30
    ws["A2"] = "Prevenimos antes de que pase"; ws["A2"].font = Font(italic=True, color="FFC400"); ws["A2"].fill = negro
    ws.merge_cells("A2:D2")
    info = [("Generado el", _f(datos["generado_en"])), ("Generado por", datos["generado_por"]),
            ("Alcance", datos["alcance"]), ("Filtros", " · ".join(datos["filtros"])), ("", "")]
    met = [("Total de incidencias", R["total"]), ("Abiertas", R["abierto"]), ("En proceso", R["en_proceso"]),
           ("Cerradas", R["cerrado"]), ("Prioridad alta", R["alta"]), ("Prioridad media", R["media"]),
           ("Prioridad baja", R["baja"]),
           ("Tiempo promedio de cierre (días)", R["promedio_cierre"] if R["promedio_cierre"] is not None else "—")]
    fila = 4
    for k, v in info:
        ws.cell(row=fila, column=1, value=k).font = Font(bold=True); ws.cell(row=fila, column=2, value=v); fila += 1
    ws.cell(row=fila, column=1, value="Indicador").fill = amarillo; ws.cell(row=fila, column=2, value="Valor").fill = amarillo
    ws.cell(row=fila, column=1).font = ws.cell(row=fila, column=2).font = Font(bold=True); fila += 1
    for k, v in met:
        ws.cell(row=fila, column=1, value=k).border = borde; ws.cell(row=fila, column=2, value=v).border = borde; fila += 1
    fila += 1
    ws.cell(row=fila, column=1, value="Estación").fill = amarillo; ws.cell(row=fila, column=2, value="Incidencias").fill = amarillo
    ws.cell(row=fila, column=1).font = ws.cell(row=fila, column=2).font = Font(bold=True); fila += 1
    for n, c in R["por_estacion"]:
        ws.cell(row=fila, column=1, value=n).border = borde; ws.cell(row=fila, column=2, value=c).border = borde; fila += 1
    ws.column_dimensions["A"].width = 34; ws.column_dimensions["B"].width = 60

    # --- Hoja Incidencias
    ws = wb.create_sheet("Incidencias")
    cols = ["#", "Fecha de registro", "Estación", "Categoría", "Departamento", "Título", "Descripción",
            "Prioridad", "Estado", "Reportó", "Asignado a", "Fecha de cierre", "Días abierto / para cerrar"]
    encabezado(ws, cols, [7, 18, 22, 22, 20, 36, 60, 11, 12, 18, 18, 16, 14])
    for i, t in enumerate(T):
        ws.append([t["id"], t["fecha"].replace(tzinfo=None) if t["fecha"] else None, t["estacion"], t["categoria"],
                   t["departamento"], t["titulo"], t["descripcion"], PRIORIDADES.get(t["prioridad"], t["prioridad"]),
                   ESTADOS.get(t["estado"], t["estado"]), t["creado_por"], t["asignado_a"],
                   t["fecha_cierre"].replace(tzinfo=None) if t["fecha_cierre"] else None, t["dias"]])
        r = ws.max_row
        for col in (2, 12):
            ws.cell(row=r, column=col).number_format = "dd/mm/yyyy hh:mm"
        ws.cell(row=r, column=7).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=r, column=8).font = Font(bold=True, color=color.get(t["prioridad"], "111111"))
        ws.cell(row=r, column=9).font = Font(bold=True, color=color.get(t["estado"], "111111"))
        if i % 2:
            for col in range(1, len(cols) + 1):
                ws.cell(row=r, column=col).fill = gris

    # --- Hojas de seguimiento
    ws = wb.create_sheet("Historial de estados")
    encabezado(ws, ["Ticket #", "Título", "Fecha", "Usuario", "Estado anterior", "Estado nuevo"], [10, 40, 18, 18, 16, 16])
    for t in T:
        for h in t["historial"]:
            ws.append([t["id"], t["titulo"], h["fecha"].replace(tzinfo=None), h["usuario"],
                       ESTADOS.get(h["de"], h["de"]), ESTADOS.get(h["a"], h["a"])])
            ws.cell(row=ws.max_row, column=3).number_format = "dd/mm/yyyy hh:mm"

    ws = wb.create_sheet("Comentarios")
    encabezado(ws, ["Ticket #", "Título", "Fecha", "Usuario", "Comentario"], [10, 36, 18, 18, 80])
    for t in T:
        for c in t["comentarios"]:
            ws.append([t["id"], t["titulo"], c["fecha"].replace(tzinfo=None), c["usuario"], c["texto"]])
            ws.cell(row=ws.max_row, column=3).number_format = "dd/mm/yyyy hh:mm"
            ws.cell(row=ws.max_row, column=5).alignment = Alignment(wrap_text=True, vertical="top")

    buf = BytesIO(); wb.save(buf)
    return buf.getvalue()


# =========================================================
# Vista
# =========================================================
class ReporteIncidenciasView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        formato = request.query_params.get("formato", "pdf").lower()
        if formato not in ("pdf", "xlsx"):
            return Response({"detail": "formato debe ser pdf o xlsx"}, status=400)
        try:
            datos = armar_datos(request.user, request.query_params)
        except ValueError:
            return Response({"detail": "Fechas inválidas, usa AAAA-MM-DD."}, status=400)

        nombre = f"reporte_incidencias_{timezone.localtime():%Y%m%d_%H%M}"
        if formato == "pdf":
            resp = HttpResponse(generar_pdf(datos), content_type="application/pdf")
        else:
            resp = HttpResponse(
                generar_xlsx(datos),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        resp["Content-Disposition"] = f'attachment; filename="{nombre}.{formato}"'
        resp["Access-Control-Expose-Headers"] = "Content-Disposition"
        return resp
