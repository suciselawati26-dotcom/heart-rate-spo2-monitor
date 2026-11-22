# PulseSense — ESP32 Heart Rate & SpO₂ IoT Monitor

Dashboard dark navy/cyan/ungu untuk ESP32 + MAX30102 + Firebase Realtime Database + GitHub Pages.

## Isi folder
- `ESP32_HeartRate_SpO2.ino` — firmware ESP32
- `index.html` — halaman dashboard
- `style.css` — desain responsif
- `script.js` — Firebase listener dan grafik Chart.js

## 1. Rangkaian
| MAX30102 | ESP32 DevKit |
|---|---|
| VIN | 3V3 |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| INT | Tidak digunakan |

Gunakan kabel pendek dan pastikan modul MAX30102 kompatibel dengan 3,3 V.

## 2. Instalasi Arduino IDE
1. Instal Arduino IDE.
2. Tambahkan board ESP32 melalui Boards Manager (paket `esp32` oleh Espressif Systems).
3. Pilih board ESP32 Dev Module dan port COM yang sesuai.
4. Buka Library Manager, instal **SparkFun MAX3010x Pulse and Proximity Sensor Library**.
5. Buka `ESP32_HeartRate_SpO2.ino`.
6. Isi `WIFI_SSID`, `WIFI_PASSWORD`, dan `FIREBASE_DATABASE_URL`.
7. Upload, lalu buka Serial Monitor pada 115200 baud.

## 3. Firebase Realtime Database
1. Buka https://console.firebase.google.com dan buat project.
2. Buat Realtime Database, pilih lokasi yang dekat (misalnya Singapore/asia-southeast1 bila tersedia).
3. Daftarkan aplikasi Web dari Project settings > Your apps.
4. Salin konfigurasi Web ke `script.js`.
5. Salin URL database ke firmware ESP32.
6. Pastikan aturan keamanan mengizinkan pembacaan web yang terautentikasi dan penulisan ESP32 yang terautentikasi.

### Mode uji cepat (TIDAK AMAN / hanya prototipe lokal)
Firmware contoh memakai REST tanpa autentikasi jika `FIREBASE_AUTH_TOKEN` kosong. Agar berhasil, database harus mengizinkan read/write tanpa autentikasi. Aturan publik dapat membuat siapa pun membaca, menimpa, atau menghapus data. Gunakan hanya pada proyek uji tanpa data pribadi, segera tutup kembali setelah pengujian, dan jangan pernah menyimpan data kesehatan pribadi pada database publik.

Untuk penggunaan yang lebih aman, implementasikan Firebase Authentication (misalnya akun perangkat khusus) dan aturan database berbasis `auth`; jangan gunakan aturan `.read: true` / `.write: true` untuk deployment.

Struktur data yang ditulis:
```json
{
  "monitoring": {
    "bpm": 78,
    "spo2": 98,
    "validBpm": true,
    "validSpo2": true,
    "sensorReady": true,
    "status": "online",
    "device": "ESP32",
    "timestamp": 1795350000
  }
}
```
Nilai di atas hanya contoh. Timestamp adalah Unix epoch detik.

## 4. Konfigurasi dashboard
Edit bagian `firebaseConfig` di `script.js`:
- `apiKey`
- `authDomain`
- `databaseURL`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Salin nilai persis dari Firebase Console > Project settings > General > Your apps > SDK setup and configuration. Jangan menaruh service-account private key atau kredensial server di JavaScript publik.

## 5. Upload ke GitHub Pages
1. Buat repository GitHub, misalnya `heart-rate-spo2-monitor`.
2. Upload `index.html`, `style.css`, `script.js`, dan README.
3. Buka Settings > Pages.
4. Build and deployment: pilih Deploy from a branch.
5. Branch `main`, folder `/ (root)`, klik Save.
6. Tunggu publikasi, lalu buka URL yang ditampilkan GitHub Pages, biasanya:
   `https://USERNAME.github.io/heart-rate-spo2-monitor/`

## 6. Uji sistem
1. Nyalakan ESP32 dan pastikan Serial Monitor menunjukkan Wi-Fi terhubung.
2. Letakkan ujung jari dengan lembut dan stabil pada sensor.
3. Tunggu beberapa detik untuk pengisian buffer dan kalkulasi.
4. Periksa node `monitoring` di Firebase.
5. Buka dashboard GitHub Pages. Nilai dan grafik akan diperbarui saat Firebase menerima data.

## Troubleshooting
- Sensor tidak ditemukan: cek VIN, GND, SDA/SCL, dan coba I2C scanner.
- Data tidak muncul: cek URL database, konfigurasi web Firebase, rules/auth, dan Serial Monitor HTTP status.
- Nilai tidak valid: jaga jari stabil, jangan menekan terlalu kuat, hindari cahaya luar, dan pastikan sensor menempel baik.
- Grafik kosong: periksa Console browser dan pastikan `script.js` serta Chart.js berhasil dimuat.
- `HTTP 401/403`: autentikasi atau aturan database menolak request. Jangan mengatasi dengan membiarkan database terbuka untuk publik.

## Catatan keselamatan dan keterbatasan
MAX30102 dan algoritma referensi ini cocok untuk prototipe edukasi, bukan perangkat diagnosis atau keputusan klinis. Akurasi dipengaruhi posisi jari, gerakan, perfusi, suhu, cahaya, dan kualitas modul. Validasi hasil dengan pulse oximeter medis yang tervalidasi bila diperlukan. Indikator dashboard adalah panduan visual sederhana, bukan diagnosis.

Firmware menggunakan `WiFiClientSecure::setInsecure()` untuk memudahkan uji TLS. Ini tidak memvalidasi sertifikat server dan tidak direkomendasikan untuk produksi. Gunakan validasi sertifikat/root CA untuk deployment nyata.

## Referensi
- SparkFun MAX3010x library: https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library
- Firebase Realtime Database: https://firebase.google.com/docs/database
- GitHub Pages: https://docs.github.com/pages
