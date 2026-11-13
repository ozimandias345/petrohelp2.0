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
#define PIN_DHT       4    // DHT22 (temperatura)
#define PIN_MQ2       34   // MQ-2 salida analógica (ADC1, solo entrada)
#define PIN_TRIG      5    // HC-SR04 trigger
#define PIN_ECHO      18   // HC-SR04 echo (usar divisor de voltaje 5V -> 3.3V)
#define PIN_BUZZER    25
#define PIN_LED       2    // LED integrado en la mayoría de placas

// --- Tanque (para convertir distancia del ultrasónico a %) ---
#define ALTURA_TANQUE_CM  100.0   // distancia del sensor al fondo del tanque
#define DISTANCIA_LLENO_CM 10.0   // distancia del sensor al líquido con el tanque lleno

// --- Calibración MQ-2 (aproximada; ajustar con tu sensor) ---
#define MQ2_RAW_LIMPIO   400      // lectura ADC en aire limpio
#define MQ2_PPM_MAX      1000     // ppm aproximadas a lectura ADC máxima
