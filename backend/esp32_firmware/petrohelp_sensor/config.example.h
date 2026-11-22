// Copia este archivo como "config.h" (en la misma carpeta) y llena tus datos.
#pragma once

// --- WiFi ---
#define WIFI_SSID     "TU_RED_WIFI"
#define WIFI_PASSWORD "TU_CONTRASENA"

// --- Agente FastAPI (IP de la PC donde corre uvicorn, puerto 8001) ---
#define AGENTE_URL    "http://192.168.1.100:8001/api/lecturas"

// --- Identidad del dispositivo (debe existir en dispositivos.json) ---
#define DEVICE_ID     "esp32-est01-tanque1"
#define DEVICE_KEY    "cambia-esta-clave-01"

// --- Intervalo de envío (ms) ---
#define INTERVALO_MS  30000

// --- Pines ---
// Pines elegidos para la placa ESP32-S3-DevKitC-1 (modulo WROOM-1 N16R8).
// OJO: en esta placa los GPIO 33 a 37 los ocupa la PSRAM y NO se pueden usar.
// Las entradas analogicas validas son del GPIO 1 al 10 (ADC1).
#define PIN_DHT       4    // DHT22 (temperatura y humedad)
#define PIN_MQ2       5    // MQ-2 salida analogica (ADC1; usar divisor 5V -> 3.3V)
#define PIN_TRIG      6    // HC-SR04 trigger
#define PIN_ECHO      7    // HC-SR04 echo (usar divisor de voltaje 5V -> 3.3V)
#define PIN_BUZZER    15   // buzzer activo (opcional)
#define PIN_LED_RGB   48   // LED RGB integrado de la placa

// --- Tanque (para convertir distancia del ultrasónico a %) ---
#define ALTURA_TANQUE_CM  100.0   // distancia del sensor al fondo del tanque
#define DISTANCIA_LLENO_CM 10.0   // distancia del sensor al líquido con el tanque lleno

// --- Calibración MQ-2 (aproximada; ajustar con tu sensor) ---
#define MQ2_RAW_LIMPIO   400      // lectura ADC en aire limpio
#define MQ2_PPM_MAX      1000     // ppm aproximadas a lectura ADC máxima
