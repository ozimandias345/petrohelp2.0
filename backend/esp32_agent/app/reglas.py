"""
Reglas de umbral: primera capa de detección, rápida y determinista.
La IA solo entra cuando alguna regla se dispara.

Los umbrales se pueden sobreescribir por dispositivo con la clave
"umbrales" en dispositivos.json.
"""
from dataclasses import dataclass, asdict

UMBRALES_DEFAULT = {
    # sensor: {"media": x, "alta": y, "direccion": "mayor"|"menor"}
    "gas_ppm": {"media": 150, "alta": 300, "direccion": "mayor"},
    "temperatura": {"media": 40, "alta": 50, "direccion": "mayor"},
    "nivel_tanque": {"media": 20, "alta": 10, "direccion": "menor"},
}

DESCRIPCION_SENSOR = {
    "gas_ppm": "concentración de gas (ppm aprox.)",
    "temperatura": "temperatura (°C)",
    "nivel_tanque": "nivel de tanque (%)",
}


@dataclass
class Anomalia:
    sensor: str
    valor: float
    severidad: str  # "media" | "alta"
    umbral: float
    mensaje: str

    def dict(self):
        return asdict(self)


def evaluar(lectura: dict, umbrales_dispositivo: dict | None = None) -> list[Anomalia]:
    umbrales = {**UMBRALES_DEFAULT, **(umbrales_dispositivo or {})}
    anomalias: list[Anomalia] = []

    for sensor, u in umbrales.items():
        valor = lectura.get(sensor)
        if valor is None:
            continue
        mayor = u.get("direccion", "mayor") == "mayor"
        supera = (lambda lim: valor >= lim) if mayor else (lambda lim: valor <= lim)

        severidad = None
        if supera(u["alta"]):
            severidad, umbral = "alta", u["alta"]
        elif supera(u["media"]):
            severidad, umbral = "media", u["media"]

        if severidad:
            signo = "≥" if mayor else "≤"
            anomalias.append(
                Anomalia(
                    sensor=sensor,
                    valor=valor,
                    severidad=severidad,
                    umbral=umbral,
                    mensaje=f"{DESCRIPCION_SENSOR.get(sensor, sensor)} = {valor} ({signo} {umbral})",
                )
            )
    return anomalias
