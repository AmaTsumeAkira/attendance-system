import { useEffect, useRef, useState } from 'react'
import { Camera, XCircle } from 'lucide-react'

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const streamRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setScanning(true)
        scanLoop()
      } catch (e) {
        setError('无法访问摄像头，请检查权限设置')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        // Try to read QR from image data
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          // If jsQR is available globally, use it
          if (window.jsQR) {
            const code = window.jsQR(imageData.data, imageData.width, imageData.height)
            if (code && code.data) {
              onScan(code.data)
              return
            }
          }
        } catch {}
      }
      animRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <XCircle size={48} style={{ color: 'var(--danger)', marginBottom: 12 }} />
        <p>{error}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>您可以手动输入签到码</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
      <video ref={videoRef} style={{ width: '100%', maxWidth: 400, display: 'block' }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '60%', height: '60%', border: '3px solid rgba(255,255,255,.6)', borderRadius: 12, boxShadow: '0 0 0 2000px rgba(0,0,0,.3)' }} />
      {onClose && (
        <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <XCircle size={20} />
        </button>
      )}
      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 13, background: 'rgba(0,0,0,.5)', padding: '4px 12px', borderRadius: 8 }}>
        <Camera size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        将二维码对准框内
      </div>
    </div>
  )
}
