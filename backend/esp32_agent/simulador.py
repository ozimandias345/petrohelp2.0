"""
Simulador de ESP32: manda lecturas al agente sin necesidad de hardware.

Uso:
  python simulador.py                       # lecturas normales cada 5 s
  python simulador.py --escenario fuga      # fuga de gas progresiva
  python simulador.py --escenario calor     # sobrecalentamiento
  python simulador.py --escenario tanque    # tanque vaciándose
  python simulador.py --una                 # manda una sola lectura
"""
import argparse
import json
import random
import time
import urllib.request

p = argparse.ArgumentParser()
p.add_argument("--url", default="http://127.0.0.1:8001/api/lecturas")
p.add_argument("--device-id", default="esp32-est01-tanque1")
p.add_argument("--key", default="cambia-esta-clave-01")
p.add_argument("--escenario", choices=["normal", "fuga", "calor", "tanque"], default="normal")
p.add_argument("--intervalo", type=float, default=5)
p.add_argument("--una", action="store_true")
args = p.parse_args()

paso = 0
nivel = 65.0
while True:
    temp = round(random.uniform(24, 30), 1)
    gas = round(random.uniform(20, 60))
    if args.escenario == "fuga":
        gas = 40 + paso * 45
    elif args.escenario == "calor":
        temp = 30 + paso * 3.5
    elif args.escenario == "tanque":
        nivel = max(0.0, 40 - paso * 4)
    else:
        nivel = max(0.0, nivel - random.uniform(0, 0.3))

    cuerpo = {"temperatura": temp, "gas_ppm": gas, "nivel_tanque": round(nivel, 1),
              "extra": {"rssi": random.randint(-75, -50), "simulado": True}}
    req = urllib.request.Request(
        args.url, data=json.dumps(cuerpo).encode(), method="POST",
        headers={"Content-Type": "application/json",
                 "X-Device-Id": args.device_id, "X-Device-Key": args.key},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(cuerpo, "->", r.read().decode())
    except Exception as e:  # noqa: BLE001
        print("Error:", e)

    if args.una:
        break
    paso += 1
    time.sleep(args.intervalo)
