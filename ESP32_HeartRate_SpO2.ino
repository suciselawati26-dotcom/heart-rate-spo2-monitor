/*
  PulseSense - ESP32 + MAX30102 + Firebase Realtime Database
  Wiring: MAX30102 VIN->3V3, GND->GND, SDA->GPIO21, SCL->GPIO22
  Install library: SparkFun MAX3010x Pulse and Proximity Sensor Library
  Uses the Maxim SpO2 algorithm header included with that library.

  PROTOTYPE SECURITY NOTE:
  This example uses unauthenticated Firebase REST writes for a quick classroom
  prototype. It requires temporary public write rules. Do NOT use public rules
  for a real deployment or sensitive/medical data. Add Firebase Authentication
  and restrictive database rules before deployment.
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <time.h>

const char* WIFI_SSID = "GANTI_NAMA_WIFI";
const char* WIFI_PASSWORD = "GANTI_PASSWORD_WIFI";

// Example: https://nama-proyek-default-rtdb.asia-southeast1.firebasedatabase.app
const char* FIREBASE_DATABASE_URL = "https://GANTI_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* FIREBASE_AUTH_TOKEN = ""; // Kosong untuk mode uji publik; jangan gunakan di produksi.

#define I2C_SDA 21
#define I2C_SCL 22
#define BUFFER_LENGTH 100
#define FINGER_THRESHOLD 50000

MAX30105 particleSensor;
uint32_t irBuffer[BUFFER_LENGTH];
uint32_t redBuffer[BUFFER_LENGTH];

int32_t spo2 = 0;
int32_t heartRate = 0;
int8_t validSPO2 = 0;
int8_t validHeartRate = 0;

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 1000;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi terhubung. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi belum terhubung.");
  }
}

bool readInitialBuffer() {
  Serial.println("Mengambil 100 sampel awal...");
  for (int i = 0; i < BUFFER_LENGTH; i++) {
    unsigned long start = millis();
    while (!particleSensor.available()) {
      particleSensor.check();
      if (millis() - start > 1500) return false;
      delay(1);
    }
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();
  }
  return true;
}

bool readNextSamples() {
  // Geser 75 sampel terakhir, lalu ambil 25 sampel baru.
  for (int i = 25; i < BUFFER_LENGTH; i++) {
    redBuffer[i - 25] = redBuffer[i];
    irBuffer[i - 25] = irBuffer[i];
  }
  for (int i = 75; i < BUFFER_LENGTH; i++) {
    unsigned long start = millis();
    while (!particleSensor.available()) {
      particleSensor.check();
      if (millis() - start > 1500) return false;
      delay(1);
    }
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample();
  }
  return true;
}

bool fingerPresent() {
  uint32_t irAverage = 0;
  for (int i = 0; i < BUFFER_LENGTH; i++) irAverage += irBuffer[i] / BUFFER_LENGTH;
  return irAverage > FINGER_THRESHOLD;
}

void calculateVitals() {
  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, BUFFER_LENGTH, redBuffer,
    &spo2, &validSPO2, &heartRate, &validHeartRate
  );
  // Filter rentang teknis untuk mencegah nilai algoritma tidak masuk akal.
  if (heartRate < 30 || heartRate > 220) validHeartRate = 0;
  if (spo2 < 70 || spo2 > 100) validSPO2 = 0;
}

void sendToFirebase(bool sensorReady) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  time_t now;
  time(&now);
  if (now < 100000) now = millis() / 1000;

  String json = "{";
  json += "\"bpm\":" + String(validHeartRate ? heartRate : 0) + ",";
  json += "\"spo2\":" + String(validSPO2 ? spo2 : 0) + ",";
  json += "\"validBpm\":" + String(validHeartRate ? "true" : "false") + ",";
  json += "\"validSpo2\":" + String(validSPO2 ? "true" : "false") + ",";
  json += "\"sensorReady\":" + String(sensorReady ? "true" : "false") + ",";
  json += "\"status\":\"online\",";
  json += "\"device\":\"ESP32\",";
  json += "\"timestamp\":" + String((unsigned long)now);
  json += "}";

  WiFiClientSecure client;
  client.setInsecure(); // Untuk pengujian. Produksi: validasi sertifikat TLS.
  HTTPClient http;
  String url = String(FIREBASE_DATABASE_URL) + "/monitoring.json";
  if (strlen(FIREBASE_AUTH_TOKEN) > 0) url += "?auth=" + String(FIREBASE_AUTH_TOKEN);

  if (http.begin(client, url)) {
    http.addHeader("Content-Type", "application/json");
    int code = http.PUT(json);
    Serial.print("Firebase HTTP: "); Serial.println(code);
    Serial.println(json);
    if (code < 200 || code >= 300) Serial.println(http.getString());
    http.end();
  } else {
    Serial.println("Gagal memulai koneksi Firebase.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin(I2C_SDA, I2C_SCL);

  connectWiFi();
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 tidak ditemukan. Periksa kabel dan catu daya.");
    while (true) {
      sendToFirebase(false);
      delay(5000);
    }
  }

  // Parameter awal sensor; dapat perlu disesuaikan menurut modul dan kondisi.
  byte ledBrightness = 60;
  byte sampleAverage = 4;
  byte ledMode = 2;       // Red + IR
  int sampleRate = 100;   // 100 sampel/detik
  int pulseWidth = 411;
  int adcRange = 4096;
  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.setPulseAmplitudeRed(0x2A);
  particleSensor.setPulseAmplitudeIR(0x2A);
  particleSensor.setPulseAmplitudeGreen(0);

  if (!readInitialBuffer()) {
    Serial.println("Timeout membaca sensor.");
    return;
  }
  calculateVitals();
  sendToFirebase(true);
}

void loop() {
  if (!readNextSamples()) {
    Serial.println("Timeout sampel MAX30102.");
    sendToFirebase(false);
    delay(500);
    return;
  }

  if (!fingerPresent()) {
    validHeartRate = 0;
    validSPO2 = 0;
    Serial.println("Letakkan jari pada sensor.");
  } else {
    calculateVitals();
    Serial.print("BPM: "); Serial.print(heartRate);
    Serial.print(" valid="); Serial.print(validHeartRate);
    Serial.print(" | SpO2: "); Serial.print(spo2);
    Serial.print(" valid="); Serial.println(validSPO2);
  }

  if (millis() - lastSend >= SEND_INTERVAL) {
    sendToFirebase(true);
    lastSend = millis();
  }
}
