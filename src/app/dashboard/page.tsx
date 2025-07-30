'use client';
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

const NOTIFY_SOUND_URL = "/sounds/Test.wav";

type AlertItem = {
  message: string;
  keyword: string;
  time: string;
  transcript?: string;
  receivedAt: string;
  from: string;
};

const alertStyles: { [key: string]: string } = {
  "ขอความช่วยเหลือเร่งด่วน": "bg-red-100 border-l-4 border-red-500",
  "ขอความช่วยเหลือ (เจ็บ)": "bg-red-100 border-l-4 border-red-500",
  "ขอความช่วยเหลือ (ปวด)": "bg-red-100 border-l-4 border-red-500",
  "ขอเข้าห้องน้ำ (ปวดหนัก)": "bg-yellow-100 border-l-4 border-yellow-500",
  "ขอเข้าห้องน้ำ (ปวดเบา)": "bg-yellow-100 border-l-4 border-yellow-500",
  "ขอดื่มน้ำ": "bg-blue-100 border-l-4 border-blue-500",
  "ขออาหาร/หิวข้าว": "bg-green-100 border-l-4 border-green-500",
};

function speakThai(text: string) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = "th-TH";
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  } else {
    // fallback: log
    console.warn("SpeechSynthesis not supported");
  }
}

let socketSingleton: Socket | null = null;

export default function Dashboard() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- Connect socket, listen alert ---
  useEffect(() => {
    if (!socketSingleton) {
      socketSingleton = io("http://localhost:4000");
    }
    const socket = socketSingleton;

    // Unlock speech
    speakThai("");

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
    });

    socket.on("connect_error", (err: Error) => {
      setError(`ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์: ${err.message}`);
      setConnected(false);
    });

    socket.on("alert", (data: AlertItem) => {
      const now = new Date();
      // กรณี receivedAt ไม่มีมา ให้ใส่เวลาปัจจุบัน
      const receivedAlert: AlertItem = {
        ...data,
        receivedAt: data.receivedAt || now.toISOString(),
      };
      setAlerts((prev) => [receivedAlert, ...prev]);

      // เล่นเสียงเตือน
      try {
        const audio = new Audio(NOTIFY_SOUND_URL);
        audio.play();
      } catch (e) {
        console.error("Audio playback error:", e);
      }

      // พูดข้อความ (delay นิดหน่อยป้องกันเสียงชนกัน)
      setTimeout(() => speakThai(data.message), 500);

      // Toast
      setToast(`${data.message}${data.transcript ? ` (${data.transcript})` : ""}`);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setToast(null), 3500);
    });

    return () => {
      socket.off("alert");
      socket.off("connect");
      socket.off("connect_error");
      setConnected(false);
      // ปิด socket แค่ถ้าไม่มีหน้าดู Dashboard แล้วจริงๆ
      // socket.disconnect();
    };
  }, []);

  // --- Clear alerts ---
  const clearAlerts = () => setAlerts([]);

  // --- Test alert for demo ---
  const handleTest = () => {
    try {
      const audio = new Audio(NOTIFY_SOUND_URL);
      audio.play();
    } catch {
      //
    }
    speakThai("ทดสอบการแจ้งเตือน");
    setToast("ทดสอบการแจ้งเตือน");
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2500);
  };

  return (
    <main className="max-w-2xl mx-auto p-6 min-h-screen bg-gray-50 font-sans">
      <h2 className="text-2xl font-bold text-teal-700 text-center mb-4">🧑‍⚕️ Dashboard (Caregiver)</h2>
      {connected && (
        <p className="text-green-500 text-center mb-4" aria-live="polite">
          เชื่อมต่อเซิร์ฟเวอร์สำเร็จ
        </p>
      )}
      {error && (
        <p className="text-red-600 mb-4 bg-red-100 p-3 rounded-lg" aria-live="assertive">
          {error}
        </p>
      )}
      <div className="flex gap-4 mb-4 justify-center">
        <button
          className={`px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition ${alerts.length === 0 ? "hidden" : "block"}`}
          onClick={clearAlerts}
          aria-label="ล้างรายการแจ้งเตือนทั้งหมด"
        >
          ล้างรายการแจ้งเตือน
        </button>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
          onClick={handleTest}
          aria-label="ทดสอบเสียงแจ้งเตือน"
        >
          🔊 ทดสอบเสียง
        </button>
      </div>
      <ul className="space-y-3">
        {alerts.length === 0 && <li className="text-gray-500 text-center">ยังไม่มีแจ้งเตือน</li>}
        {alerts.map((a, i) => (
          <li
            key={i}
            className={`p-4 rounded-lg shadow-sm animate-fade-in transition ${alertStyles[a.message] || "bg-white"}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-teal-600">{a.message}</span>
              {a.transcript && (
                <span className="text-sm text-gray-600">[{a.transcript}]</span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1 grid grid-cols-3 gap-2">
              <div>เวลา: {a.time}</div>
              <div>ได้รับ: {new Date(a.receivedAt).toLocaleString("th-TH")}</div>
              <div>จาก: {a.from}</div>
            </div>
          </li>
        ))}
      </ul>
      {toast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-teal-500 text-white px-6 py-3 rounded-full shadow-lg z-50 animate-fade-in" aria-live="polite">
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(32px);}
          to { opacity: 1; transform: translateY(0);}
        }
        .animate-fade-in {
          animation: fade-in 0.4s cubic-bezier(.42,0,.58,1) both;
        }
      `}</style>
    </main>
  );
}
