// PulseSense: Firebase Realtime Database Web SDK (modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// GANTI seluruh nilai berikut dari Firebase Console > Project settings > Your apps.
const firebaseConfig = {
  apiKey: "GANTI_API_KEY",
  authDomain: "GANTI_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://GANTI_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "GANTI_PROJECT_ID",
  storageBucket: "GANTI_PROJECT_ID.appspot.com",
  messagingSenderId: "GANTI_MESSAGING_SENDER_ID",
  appId: "GANTI_APP_ID"
};

const $ = (id) => document.getElementById(id);
const maxPoints = 30;
const labels = [];
const bpmSeries = [];
const spo2Series = [];

const chart = new Chart($("vitalsChart"), {
  type: "line",
  data: {
    labels,
    datasets: [
      { label: "BPM", data: bpmSeries, borderColor: "#27d3e6", backgroundColor: "#27d3e622", tension: .35, pointRadius: 2, yAxisID: "y" },
      { label: "SpO2", data: spo2Series, borderColor: "#b17cff", backgroundColor: "#b17cff22", tension: .35, pointRadius: 2, yAxisID: "y1" }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: "#8194ad", maxTicksLimit: 8 }, grid: { color: "#26364b" } },
      y: { position: "left", min: 40, max: 180, ticks: { color: "#27d3e6" }, grid: { color: "#26364b" }, title: { display: true, text: "BPM", color: "#27d3e6" } },
      y1: { position: "right", min: 70, max: 100, ticks: { color: "#b17cff" }, grid: { drawOnChartArea: false }, title: { display: true, text: "SpO₂ (%)", color: "#b17cff" } }
    }
  }
});

function setConnection(isOnline) {
  $("connectionPill").textContent = isOnline ? "● Online" : "● Offline";
  $("connectionPill").classList.toggle("online", isOnline);
  $("topStatus").textContent = isOnline ? "Menerima data" : "Menunggu data";
  $("dbStatus").textContent = isOnline ? "Terhubung" : "Terputus";
  $("deviceFirebase").textContent = isOnline ? "Terhubung" : "Terputus";
}

function statusLabel(value, kind) {
  if (kind === "bpm") {
    if (value < 60 || value > 100) return ["Di luar rentang acuan dewasa istirahat", "warn"];
    return ["Dalam rentang acuan dewasa istirahat", "good"];
  }
  if (value >= 95) return ["Dalam rentang acuan umum", "good"];
  if (value >= 90) return ["Perlu perhatian", "warn"];
  return ["Nilai rendah - verifikasi", "bad"];
}
function applyState(id, value, kind) {
  const [label, cls] = statusLabel(value, kind);
  $(id).textContent = label;
  $(id).className = `state ${cls}`;
}

function showMeasurement(data) {
  if (!data) return;
  const bpm = Number(data.bpm);
  const spo2 = Number(data.spo2);
  const validBpm = data.validBpm === true && Number.isFinite(bpm) && bpm > 0;
  const validSpo2 = data.validSpo2 === true && Number.isFinite(spo2) && spo2 > 0;

  $("bpmValue").textContent = validBpm ? Math.round(bpm) : "--";
  $("spo2Value").textContent = validSpo2 ? Math.round(spo2) : "--";
  $("bpmStatus").textContent = validBpm ? "Data valid dari sensor" : "Pengukuran tidak valid";
  $("bpmStatus").className = "state " + (validBpm ? "good" : "neutral");
  $("spo2Status").textContent = validSpo2 ? "Data valid dari sensor" : "Pengukuran tidak valid";
  $("spo2Status").className = "state " + (validSpo2 ? "good" : "neutral");

  if (validBpm) applyState("bpmStatus", bpm, "bpm");
  if (validSpo2) applyState("spo2Status", spo2, "spo2");

  const online = data.status === "online";
  setConnection(online);
  $("espStatus").textContent = online ? "Online" : "Offline";
  $("sensorStatus").textContent = data.sensorReady ? "Aktif" : "Periksa sensor";
  $("deviceEsp").textContent = online ? "Online" : "Offline";
  $("deviceSensor").textContent = data.sensorReady ? "Aktif" : "Tidak siap";

  const date = data.timestamp ? new Date(Number(data.timestamp) * 1000) : new Date();
  $("lastUpdate").textContent = date.toLocaleTimeString("id-ID");
  if (validBpm || validSpo2) {
    labels.push(date.toLocaleTimeString("id-ID"));
    bpmSeries.push(validBpm ? bpm : null);
    spo2Series.push(validSpo2 ? spo2 : null);
    if (labels.length > maxPoints) { labels.shift(); bpmSeries.shift(); spo2Series.shift(); }
    chart.update("none");
  }
}

try {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  $("dbStatus").textContent = "Menghubungkan";
  onValue(ref(db, "monitoring"), (snapshot) => {
    if (snapshot.exists()) showMeasurement(snapshot.val());
    else setConnection(false);
  }, (error) => {
    console.error("Firebase read error:", error);
    setConnection(false);
    $("topStatus").textContent = "Periksa konfigurasi/aturan Firebase";
  });
} catch (error) {
  console.error(error);
  $("topStatus").textContent = "Konfigurasi Firebase belum diisi";
  $("dbStatus").textContent = "Belum dikonfigurasi";
}

// Sidebar mobile
$("menuButton").addEventListener("click", () => {
  $("sidebar").classList.add("open"); $("scrim").classList.add("show");
});
function closeMenu() {
  $("sidebar").classList.remove("open"); $("scrim").classList.remove("show");
}
$("closeMenu").addEventListener("click", closeMenu);
$("scrim").addEventListener("click", closeMenu);
document.querySelectorAll(".nav-item").forEach(a => a.addEventListener("click", closeMenu));
