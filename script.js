// PulseSense: Firebase Realtime Database Web SDK (modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDn3RE8OaK-lMh6Zx-vDLkvOVXejjRdsSI",
  authDomain: "heartrate-spo2-monitor.firebaseapp.com",
  databaseURL: "https://heartrate-spo2-monitor-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "heartrate-spo2-monitor",
  storageBucket: "heartrate-spo2-monitor.firebasestorage.app",
  messagingSenderId: "858885346640",
  appId: "1:858885346640:web:9e52f5790317c8218d8855",
  measurementId: "G-VERC1PLSKM"
};

const $ = (id) => document.getElementById(id);
const setText = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};

const maxPoints = 30;
const labels = [];
const bpmSeries = [];
const spo2Series = [];

const chartCanvas = $("vitalsChart");
const chart = chartCanvas
  ? new Chart(chartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "BPM", data: bpmSeries, borderColor: "#27d3e6", backgroundColor: "#27d3e622", tension: 0.35, pointRadius: 2, yAxisID: "y" },
          { label: "SpO2", data: spo2Series, borderColor: "#b17cff", backgroundColor: "#b17cff22", tension: 0.35, pointRadius: 2, yAxisID: "y1" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8194ad", maxTicksLimit: 8 }, grid: { color: "#26364b" } },
          y: { position: "left", min: 40, max: 180, ticks: { color: "#27d3e6" }, grid: { color: "#26364b" }, title: { display: true, text: "BPM", color: "#27d3e6" } },
          y1: { position: "right", min: 70, max: 100, ticks: { color: "#b17cff" }, grid: { drawOnChartArea: false }, title: { display: true, text: "SpO₂ (%)", color: "#b17cff" } }
        }
      }
    })
  : null;

function setConnection(isOnline) {
  const pill = $("connectionPill");
  if (pill) {
    pill.textContent = isOnline ? "● Online" : "● Offline";
    pill.classList.toggle("online", isOnline);
  }
  setText("topStatus", isOnline ? "Menerima data" : "Menunggu data");
  setText("dbStatus", isOnline ? "Terhubung" : "Terputus");
  setText("deviceFirebase", isOnline ? "Terhubung" : "Terputus");
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
  const el = $(id);
  if (!el) return;
  const [label, cls] = statusLabel(value, kind);
  el.textContent = label;
  el.className = `state ${cls}`;
}

function parseTimestamp(rawTs) {
  const num = Number(rawTs);
  if (!rawTs || !Number.isFinite(num) || num <= 0) return new Date();
  return new Date(num > 1e12 ? num : num * 1000);
}

function showMeasurement(data) {
  if (!data || typeof data !== "object") return;
  const bpm = Number(data.bpm);
  const spo2 = Number(data.spo2);
  const validBpm = data.validBpm === true && Number.isFinite(bpm) && bpm > 0;
  const validSpo2 = data.validSpo2 === true && Number.isFinite(spo2) && spo2 > 0;

  setText("bpmValue", validBpm ? Math.round(bpm) : "--");
  setText("spo2Value", validSpo2 ? Math.round(spo2) : "--");

  const bpmSt = $("bpmStatus");
  if (bpmSt) {
    bpmSt.textContent = validBpm ? "Data valid dari sensor" : "Pengukuran tidak valid";
    bpmSt.className = "state " + (validBpm ? "good" : "neutral");
  }

  const spo2St = $("spo2Status");
  if (spo2St) {
    spo2St.textContent = validSpo2 ? "Data valid dari sensor" : "Pengukuran tidak valid";
    spo2St.className = "state " + (validSpo2 ? "good" : "neutral");
  }

  if (validBpm) applyState("bpmStatus", bpm, "bpm");
  if (validSpo2) applyState("spo2Status", spo2, "spo2");

  const online = data.status === "online";
  setConnection(online);
  setText("espStatus", online ? "Online" : "Offline");
  setText("sensorStatus", data.sensorReady ? "Aktif" : "Periksa sensor");
  setText("deviceEsp", online ? "Online" : "Offline");
  setText("deviceSensor", data.sensorReady ? "Aktif" : "Tidak siap");

  const date = parseTimestamp(data.timestamp);
  const timeLabel = date.toLocaleTimeString("id-ID");
  setText("lastUpdate", timeLabel);

  if (chart && (validBpm || validSpo2)) {
    labels.push(timeLabel);
    bpmSeries.push(validBpm ? bpm : null);
    spo2Series.push(validSpo2 ? spo2 : null);
    if (labels.length > maxPoints) {
      labels.shift();
      bpmSeries.shift();
      spo2Series.shift();
    }
    chart.update("none");
  }
}

try {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  setText("dbStatus", "Menghubungkan");
  onValue(
    ref(db, "monitoring"),
    (snapshot) => {
      if (snapshot.exists()) showMeasurement(snapshot.val());
      else setConnection(false);
    },
    (error) => {
      console.error("Firebase read error:", error);
      setConnection(false);
      setText("topStatus", "Periksa konfigurasi/aturan Firebase");
    }
  );
} catch (error) {
  console.error(error);
  setText("topStatus", "Konfigurasi Firebase belum diisi");
  setText("dbStatus", "Belum dikonfigurasi");
}

// Sidebar mobile
const menuBtn = $("menuButton");
const sidebar = $("sidebar");
const scrim = $("scrim");
const closeBtn = $("closeMenu");

function closeMenu() {
  sidebar?.classList.remove("open");
  scrim?.classList.remove("show");
}

menuBtn?.addEventListener("click", () => {
  sidebar?.classList.add("open");
  scrim?.classList.add("show");
});
closeBtn?.addEventListener("click", closeMenu);
scrim?.addEventListener("click", closeMenu);
document.querySelectorAll(".nav-item").forEach((a) => a.addEventListener("click", closeMenu));
