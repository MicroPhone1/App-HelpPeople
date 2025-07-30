'use client';
import { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

const TRIGGERS = [
  { keyword: "หนัก", label: "ขอเข้าห้องน้ำ (ปวดหนัก)" },
  { keyword: "เบา", label: "ขอเข้าห้องน้ำ (ปวดเบา)" },
  { keyword: "น้ำ", label: "ขอดื่มน้ำ" },
  { keyword: "ข้าว", label: "ขออาหาร/หิวข้าว" },
  { keyword: "ช่วยด้วย", label: "ขอความช่วยเหลือเร่งด่วน" },
  { keyword: "เจ็บ", label: "ขอความช่วยเหลือ (เจ็บ)" },
  { keyword: "ปวด", label: "ขอความช่วยเหลือ (ปวด)" },
];

export default function Patient() {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecognizingRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // --- Connect to Socket.IO ---
  useEffect(() => {
    const socket = io("http://localhost:4000", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setError(null);
      setLastCommand("เชื่อมต่อเซิร์ฟเวอร์สำเร็จ!");
      clearTimeout(timeoutRef.current!);
      timeoutRef.current = setTimeout(() => setLastCommand(null), 2000);
    });

    socket.on("connect_error", (err) => {
      setError(`ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์: ${err.message}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // --- Voice Recognition ---
  useEffect(() => {
    isUnmountedRef.current = false;

    const SpeechRecognition: typeof window.SpeechRecognition | undefined =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง กรุณาใช้ Chrome หรือ Edge");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "th-TH";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isRecognizingRef.current = true;
      if (!isUnmountedRef.current) setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      TRIGGERS.forEach((t) => {
        if (transcript.includes(t.keyword)) {
          setLastCommand(t.label);
          clearTimeout(timeoutRef.current!);
          timeoutRef.current = setTimeout(() => setLastCommand(null), 3000);

          // ส่ง event แจ้งเตือน
          socketRef.current?.emit("alert", {
            message: t.label,
            keyword: t.keyword,
            time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
            transcript,
          });
        }
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isRecognizingRef.current = false; // <--- สำคัญ!
      if (!isUnmountedRef.current) setError(`ข้อผิดพลาด: ${event.error}. กรุณาพูดชัดเจนหรืออยู่ในที่เงียบ`);
      // ไม่ start() ซ้ำตรงนี้ ให้รอ onend
      recognition.stop();
    };

    recognition.onend = () => {
      isRecognizingRef.current = false;
      if (!isUnmountedRef.current) setIsListening(false);
      setTimeout(() => {
        // ป้องกัน start ซ้ำ
        if (!isUnmountedRef.current && !isRecognizingRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // ignore error, ถ้าติด error แบบ already started ให้รอรอบหน้า
          }
        }
      }, 1000);
    };

    // --- Start ฟังเสียงครั้งแรก (ปลอดภัยเพราะตอน mount ยังไม่ฟัง)
    try {
      recognition.start();
      isRecognizingRef.current = true;
    } catch (e) {
      // ignore
    }

    recognitionRef.current = recognition;

    return () => {
      isUnmountedRef.current = true;
      recognition.stop();
      recognitionRef.current = null;
      isRecognizingRef.current = false;
      clearTimeout(timeoutRef.current!);
    };
  }, []);

  // --- UI ---
  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-gray-100 p-4">
      <h2 className="text-2xl font-bold text-red-600 mb-4">🚨 ระบบแจ้งเตือนด้วยเสียง (AUTO)</h2>
      <p className="text-lg text-gray-700 mb-4">พูดคำเหล่านี้เพื่อแจ้งผู้ดูแล:</p>
      <ul className="list-disc list-inside mb-6">
        {TRIGGERS.map((t, i) => (
          <li key={i} className="text-gray-800">
            <span className="font-semibold">{t.keyword}</span> — {t.label}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mb-4 flex-wrap justify-center">
        {TRIGGERS.map((t, i) => (
          <button
            key={i}
            className="px-3 py-1 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
            onClick={() =>
              socketRef.current?.emit("alert", {
                message: t.label,
                keyword: t.keyword,
                time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
                transcript: t.keyword,
              })
            }
          >
            {t.keyword}
          </button>
        ))}
      </div>
      {isListening ? (
        <div className="flex items-center gap-2">
          <svg className="animate-pulse w-6 h-6 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
          <p className="text-teal-500 font-medium" aria-live="polite">
            ระบบกำลังฟังเสียงอัตโนมัติ…
          </p>
        </div>
      ) : (
        <p className="text-red-500 font-medium" aria-live="polite">
          ระบบหยุดฟังชั่วคราว…
        </p>
      )}
      {lastCommand && (
        <p className="text-green-500 mt-4 animate-pulse" aria-live="polite">
          ส่งคำสั่ง: {lastCommand}
        </p>
      )}
      {error && (
        <p className="text-red-600 mt-4 bg-red-100 p-3 rounded-lg" aria-live="assertive">
          {error}
        </p>
      )}
    </main>
  );
}
