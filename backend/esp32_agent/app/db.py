"""
Almacenamiento local del agente (SQLite): lecturas de sensores y alertas.
Los tickets viven en Django/PostgreSQL; aquí solo guardamos la telemetría.
"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from .config import DB_PATH


def ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def conexion():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def inicializar():
    with conexion() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS lecturas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                temperatura REAL,
                gas_ppm REAL,
                nivel_tanque REAL,
                extra TEXT
            );
            CREATE INDEX IF NOT EXISTS ix_lecturas_dev_ts ON lecturas(device_id, ts);

            CREATE TABLE IF NOT EXISTS alertas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                ts TEXT NOT NULL,
                sensor TEXT NOT NULL,
                valor REAL,
                severidad TEXT NOT NULL,
                mensaje TEXT,
                origen TEXT,            -- 'ia' o 'reglas'
                decision TEXT,          -- explicación del agente
                ticket_id INTEGER       -- id del ticket creado en Django (o NULL)
            );
            CREATE INDEX IF NOT EXISTS ix_alertas_dev_sensor ON alertas(device_id, sensor, ts);
            """
        )


def guardar_lectura(device_id: str, temperatura, gas_ppm, nivel_tanque, extra: dict | None) -> str:
    ts = ahora_iso()
    with conexion() as con:
        con.execute(
            "INSERT INTO lecturas (device_id, ts, temperatura, gas_ppm, nivel_tanque, extra) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (device_id, ts, temperatura, gas_ppm, nivel_tanque, json.dumps(extra or {})),
        )
    return ts


def ultimas_lecturas(device_id: str, limite: int = 20) -> list[dict]:
    with conexion() as con:
        filas = con.execute(
            "SELECT * FROM lecturas WHERE device_id = ? ORDER BY id DESC LIMIT ?",
            (device_id, limite),
        ).fetchall()
    return [_fila_lectura(f) for f in filas]


def _fila_lectura(f) -> dict:
    d = dict(f)
    d["extra"] = json.loads(d.get("extra") or "{}")
    return d


def guardar_alerta(device_id, sensor, valor, severidad, mensaje, origen, decision, ticket_id) -> int:
    with conexion() as con:
        cur = con.execute(
            "INSERT INTO alertas (device_id, ts, sensor, valor, severidad, mensaje, origen, decision, ticket_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (device_id, ahora_iso(), sensor, valor, severidad, mensaje, origen, decision, ticket_id),
        )
        return cur.lastrowid


def en_cooldown(device_id: str, sensor: str, minutos: int) -> bool:
    """True si ya se creó un ticket por este sensor hace menos de `minutos`."""
    desde = (datetime.now(timezone.utc) - timedelta(minutes=minutos)).isoformat()
    with conexion() as con:
        fila = con.execute(
            "SELECT 1 FROM alertas WHERE device_id = ? AND sensor = ? AND ts >= ? "
            "AND ticket_id IS NOT NULL LIMIT 1",
            (device_id, sensor, desde),
        ).fetchone()
    return fila is not None


def listar_alertas(limite: int = 50, device_id: str | None = None) -> list[dict]:
    sql = "SELECT * FROM alertas"
    params: list = []
    if device_id:
        sql += " WHERE device_id = ?"
        params.append(device_id)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limite)
    with conexion() as con:
        return [dict(f) for f in con.execute(sql, params).fetchall()]


def alertas_recientes_count(device_id: str, horas: int = 24) -> int:
    desde = (datetime.now(timezone.utc) - timedelta(hours=horas)).isoformat()
    with conexion() as con:
        return con.execute(
            "SELECT COUNT(*) FROM alertas WHERE device_id = ? AND ts >= ?", (device_id, desde)
        ).fetchone()[0]
