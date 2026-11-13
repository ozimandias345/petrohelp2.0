/*
 * PetroHelp - Nodo sensor ESP32
 *
 * Lee temperatura (DHT22), gas (MQ-2) y nivel de tanque (HC-SR04) y los
 * envía al agente FastAPI. Si el agente responde "alerta": true, se
 * activan el buzzer y el LED.
 *
 * Librerías (Arduino IDE > Administrar bibliotecas):
 *   - "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor"
 *   - "ArduinoJson" (v7)
 * Placa: "ESP32 Dev Module" (paquete esp32 de Espressif)
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include "config.h"

DHT dht(PIN_DHT, DHT22);
unsigned long ultimoEnvio = 0;
bool alertaActiva = false;

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " OK" : " FALLO");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  }
}

float leerGasPpm() {
  // Promedio de 10 muestras para reducir ruido
  long suma = 0;
  for (int i = 0; i < 10; i++) { suma += analogRead(PIN_MQ2); delay(5); }
  int raw = suma / 10;
  if (raw <= MQ2_RAW_LIMPIO) return 0;
  // Conversión lineal aproximada (para valores reales calibrar con curva Rs/R0)
  return (float)(raw - MQ2_RAW_LIMPIO) * MQ2_PPM_MAX / (4095 - MQ2_RAW_LIMPIO);
}

float leerNivelTanque() {
  digitalWrite(PIN_TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  long duracion = pulseIn(PIN_ECHO, HIGH, 30000);  // timeout 30 ms
  if (duracion == 0) return NAN;
  float distancia = duracion * 0.0343 / 2.0;  // cm
  float util = ALTURA_TANQUE_CM - DISTANCIA_LLENO_CM;
  float nivel = (ALTURA_TANQUE_CM - distancia) / util * 100.0;
  return constrain(nivel, 0, 100);
}

void indicarAlerta(bool activa, const char* severidad) {
  alertaActiva = activa;
  digitalWrite(PIN_LED, activa ? HIGH : LOW);
  if (activa) {
    int pitidos = (severidad && strcmp(severidad, "alta") == 0) ? 5 : 2;
    for (int i = 0; i < pitidos; i++) {
      digitalWrite(PIN_BUZZER, HIGH); delay(150);
      digitalWrite(PIN_BUZZER, LOW);  delay(100);
    }
  }
}

void enviarLectura() {
  conectarWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  float temp = dht.readTemperature();
  float gas = leerGasPpm();
  float nivel = leerNivelTanque();

  JsonDocument doc;
  if (!isnan(temp))  doc["temperatura"] = round(temp * 10) / 10.0;
  doc["gas_ppm"] = round(gas);
  if (!isnan(nivel)) doc["nivel_tanque"] = round(nivel * 10) / 10.0;
  JsonObject extra = doc["extra"].to<JsonObject>();
  extra["rssi"] = WiFi.RSSI();
  extra["uptime_s"] = millis() / 1000;
  extra["heap"] = ESP.getFreeHeap();

  String cuerpo;
  serializeJson(doc, cuerpo);
  Serial.println("-> " + cuerpo);

  HTTPClient http;
  http.begin(AGENTE_URL);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int codigo = http.POST(cuerpo);

  if (codigo == 200) {
    JsonDocument resp;
    if (!deserializeJson(resp, http.getString())) {
      bool alerta = resp["alerta"] | false;
      const char* sev = resp["severidad"] | "";
      Serial.printf("<- alerta=%d severidad=%s\n", alerta, sev);
      indicarAlerta(alerta, sev);
    }
  } else {
    Serial.printf("Error HTTP %d\n", codigo);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  analogReadResolution(12);
  dht.begin();
  Serial.println("PetroHelp sensor iniciando (MQ-2 necesita ~1 min de calentamiento)");
  conectarWiFi();
}

void loop() {
  if (millis() - ultimoEnvio >= INTERVALO_MS || ultimoEnvio == 0) {
    ultimoEnvio = millis();
    enviarLectura();
  }
  delay(100);
}
