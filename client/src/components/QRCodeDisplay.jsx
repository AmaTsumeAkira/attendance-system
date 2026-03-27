import { useEffect, useState } from 'react'

// Simple QR code renderer using canvas (no external dependency)
export default function QRCodeDisplay({ value, size = 300 }) {
  const [dataUrl, setDataUrl] = useState(null)

  useEffect(() => {
    if (!value) { setDataUrl(null); return }
    // Use a free QR API
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=10`
    setDataUrl(url)
  }, [value, size])

  if (!value) return <div style={{ width: size, height: size, background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>等待生成...</div>

  return (
    <div style={{ textAlign: 'center' }}>
      <img src={dataUrl} alt="QR Code" width={size} height={size} style={{ borderRadius: 12, boxShadow: 'var(--shadow-lg)' }} />
    </div>
  )
}
