/*
 * PetroHelp - ESP32-S3 en MODO PRUEBA (sin sensores)
 * -------------------------------------------------
 * Pensado para la placa ESP32-S3-DevKitC-1 (modulo ESP32-S3-WROOM-1 N16R8).
 *
 * Que hace:
 *   - Se conecta al WiFi.
 *   - Cada INTERVALO_MS envia una lectura al agente de PetroHelp
 *     (POST /api/lecturas), igual que lo haria con sensores reales.
 *   - Los valores son SIMULADOS: no hay sensores conectados.
 *   - Al presionar el boton BOOT de la placa simula una FUGA DE GAS:
 *     el valor sube hasta pasar el umbral y el agente crea el ticket solo.
 *   - El LED RGB de la placa indica el estado.
 *
 * LED RGB:
 *   Azul      conectando al WiFi
 *   Verde     lectura enviada, todo normal
 *   Amarillo  el agente respondio con alerta media
 *   Rojo      el agente respondio con alerta alta
 *   Morado    no se pudo conectar con el agente
 *
 * No necesita instalar ninguna libreria: solo el paquete de placas "esp32".
 *
 * Cuando tengas los sensores, usa el sketch petrohelp_sensor.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"

// Prototipos (para no depender del orden de las funciones)
void color(uint8_t r, uint8_t g, uint8_t b);
void conectarWiFi();
void enviarLectura();
void pitido(int ms);

#define PIN_BOTON 0          // boton BOOT de la placa
#define LECTURAS_FUGA 6      // cuantas lecturas dura la fuga simulada

unsigned long ultimoEnvio = 0;
int pasoFuga = 0;            // 0 = normal, >0 = fuga simulada en curso
bool botonAnterior = HIGH;
float nivelTanque = 68.0;

void color(uint8_t r, uint8_t g, uint8_t b) {
  neopixelWrite(PIN_LED_RGB, r, g, b);
}

void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Conectando a la red \"%s\"", WIFI_SSID);
  color(0, 0, 40);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Conectado. IP del ESP32: ");
    Serial.println(WiFi.localIP());
    Serial.printf("Enviando lecturas a: %s\n", AGENTE_URL);
  } else {
    Serial.println("No se pudo conectar. Revisa el nombre y la contrasena,");
    Serial.println("y que la red sea de 2.4 GHz (el ESP32 no ve las de 5 GHz).");
    color(40, 0, 40);
  }
}

void enviarLectura() {
  conectarWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  // ---- valores simulados ----
  float temp = 24.0 + (random(0, 60) / 10.0);     // 24.0 a 30.0 C
  float gas  = random(20, 60);                    // ppm en aire limpio
  nivelTanque -= random(0, 4) / 10.0;             // baja poco a poco
  if (nivelTanque < 15) nivelTanque = 68.0;

  if (pasoFuga > 0) {                             // fuga simulada en curso
    int n = LECTURAS_FUGA - pasoFuga;             // 0,1,2...
    gas = 90 + n * 90;                            // 90, 180, 270, 360...
    pasoFuga--;
    Serial.printf("[FUGA SIMULADA] quedan %d lecturas\n", pasoFuga);
  }

  char cuerpo[220];
  snprintf(cuerpo, sizeof(cuerpo),
    "{\"temperatura\":%.1f,\"gas_ppm\":%.0f,\"nivel_tanque\":%.1f,"
    "\"extra\":{\"rssi\":%d,\"modo\":\"prueba_sin_sensores\"}}",
    temp, gas, nivelTanque, WiFi.RSSI());
  Serial.print("-> ");
  Serial.println(cuerpo);

  HTTPClient http;
  http.begin(AGENTE_URL);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int codigo = http.POST(cuerpo);

  if (codigo == 200) {
    String resp = http.getString();
    Serial.print("<- ");
    Serial.println(resp);
    bool alerta = resp.indexOf("\"alerta\":true") >= 0;
    bool alta   = resp.indexOf("\"severidad\":\"alta\"") >= 0;
    if (alerta && alta) {
      color(60, 0, 0);                            // rojo
      for (int i = 0; i < 5; i++) { pitido(150); delay(100); }
    } else if (alerta) {
      color(50, 35, 0);                           // amarillo
      pitido(150); delay(100); pitido(150);
    } else {
      color(0, 40, 0);                            // verde
    }
  } else if (codigo == 401) {
    Serial.println("El agente rechazo el dispositivo (401).");
    Serial.println("Revisa que DEVICE_ID y DEVICE_KEY existan en dispositivos.json.");
    color(40, 0, 40);
  } else {
    Serial.printf("Error HTTP %d. Revisa que el agente este corriendo y la IP sea correcta.\n", codigo);
    color(40, 0, 40);
  }
  http.end();
}

void pitido(int ms) {
#ifdef PIN_BUZZER
  digitalWrite(PIN_BUZZER, HIGH);
  delay(ms);
  digitalWrite(PIN_BUZZER, LOW);
#else
  delay(ms);
#endif
}

void setup() {
  Serial.begin(115200);
  delay(600);
  pinMode(PIN_BOTON, INPUT_PULLUP);
#ifdef PIN_BUZZER
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
#endif
  Serial.println();
  Serial.println("=====================================");
  Serial.println(" PetroHelp - ESP32-S3 en modo prueba");
  Serial.println(" Sin sensores: los valores son simulados.");
  Serial.println(" Presiona el boton BOOT para simular una fuga de gas.");
  Serial.println("=====================================");
  randomSeed(micros());
  conectarWiFi();
}

void loop() {
  // Boton BOOT: dispara la fuga simulada
  bool boton = digitalRead(PIN_BOTON);
  if (botonAnterior == HIGH && boton == LOW) {
    pasoFuga = LECTURAS_FUGA;
    Serial.println(">>> Boton presionado: simulando una fuga de gas <<<");
    ultimoEnvio = 0;                 // enviar de inmediato
    delay(200);                      // antirrebote
  }
  botonAnterior = boton;

  if (ultimoEnvio == 0 || millis() - ultimoEnvio >= INTERVALO_MS) {
    ultimoEnvio = millis();
    enviarLectura();
  }
  delay(50);
}
