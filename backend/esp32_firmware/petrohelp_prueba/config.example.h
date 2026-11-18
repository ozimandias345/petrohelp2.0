// Copia este archivo como "config.h" (en esta misma carpeta) y llena tus datos.
#pragma once

// ---- WiFi ----
// Importante: el ESP32 solo ve redes de 2.4 GHz, no las de 5 GHz.
#define WIFI_SSID     "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_CONTRASENA"

// ---- Agente de PetroHelp ----
// La IP de tu computadora (comando ipconfig) y el puerto 8001.
#define AGENTE_URL    "http://192.168.0.11:8001/api/lecturas"

// ---- Identidad del dispositivo ----
// Deben coincidir con un dispositivo de dispositivos.json del agente.
#define DEVICE_ID     "esp32-est01-tanque1"
#define DEVICE_KEY    "cambia-esta-clave-01"

// ---- Cada cuanto envia una lectura (ms) ----
#define INTERVALO_MS  15000

// ---- LED RGB de la placa ----
// En la ESP32-S3-DevKitC-1 suele ser el 48. Si tu placa no enciende, prueba 38.
#define PIN_LED_RGB   48

// ---- Buzzer (opcional) ----
// Descomenta solo si conectas un buzzer. No uses los pines 33 a 37:
// en los modulos con PSRAM octal (N16R8) estan ocupados internamente.
// #define PIN_BUZZER 15
