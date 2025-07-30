import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-red-600 mb-4">🚨 Voice Alert Demo</h1>
      <p className="text-lg text-gray-700 mb-6 text-center max-w-md">
        ระบบแจ้งเตือนด้วยเสียงสำหรับผู้พิการ ช่วยให้ผู้ป่วยส่งคำขอความช่วยเหลือด้วยการพูด และผู้ดูแลรับแจ้งเตือนแบบเรียลไทม์
      </p>
      <div className="flex gap-6">
        <Link href="/patient">
          <button className="px-6 py-3 text-lg font-semibold text-black bg-yellow-400 rounded-lg hover:bg-yellow-500 transition">
            👨‍🦽 ผู้ป่วย (Patient)
          </button>
        </Link>
        <Link href="/dashboard">
          <button className="px-6 py-3 text-lg font-semibold text-white bg-teal-500 rounded-lg hover:bg-teal-600 transition">
            🧑‍⚕️ ผู้ดูแล (Dashboard)
          </button>
        </Link>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        Prototype by Next.js + Socket.IO
      </p>
    </main>
  );
}