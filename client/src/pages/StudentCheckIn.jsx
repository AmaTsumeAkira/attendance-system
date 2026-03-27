import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket } from '../hooks/useWebSocket'
import { useToast } from '../components/Toast'
import { getMyAttendance } from '../api/attendance'
import { getStudentStats } from '../api/stats'
import QRScanner from '../components/QRScanner'
import StatusBadge from '../components/StatusBadge'
import { Camera, Keyboard, CheckCircle, Clock, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function StudentCheckIn() {
  const { user, token } = useAuth()
  const { send, addListener, connected } = useWebSocket(token)
  const toast = useToast()
  const [showScanner, setShowScanner] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [checkInResult, setCheckInResult] = useState(null)
  const [monthStats, setMonthStats] = useState(null)
  const [recentRecords, setRecentRecords] = useState([])

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getMyAttendance()
        const items = res.data.data?.items || res.data.data || []
        setRecentRecords(Array.isArray(items) ? items.slice(0, 10) : [])
      } catch {}
      try {
        const month = format(new Date(), 'yyyy-MM')
        const res = await getStudentStats(user.id, { month })
        setMonthStats(res.data.data)
      } catch {}
    }
    fetch()
  }, [user])

  useEffect(() => {
    const unsub = addListener('check-in-result', (msg) => {
      if (msg.type === 'check_in_result') {
        setCheckInResult(msg.payload)
        if (msg.payload.success) {
          toast.addToast('签到成功！', 'success')
        } else {
          toast.addToast(msg.payload.message || '签到失败', 'error')
        }
      }
    })
    return () => { unsub() }
  }, [addListener, toast])

  const handleScan = (data) => {
    setShowScanner(false)
    // QR token format: could be just the token string, or a URL with token
    const token = data.includes('token=') ? new URL(data).searchParams.get('token') : data
    if (token && sessionId) {
      send({ type: 'check_in', payload: { token, sessionId: parseInt(sessionId) }, reqId: Date.now().toString() })
    } else if (token) {
      setManualToken(token)
      toast.addToast('请输入会话ID', 'info')
    }
  }

  const handleManualCheckIn = () => {
    if (!manualToken || !sessionId) {
      toast.addToast('请输入签到码和会话ID', 'warning')
      return
    }
    send({ type: 'check_in', payload: { token: manualToken, sessionId: parseInt(sessionId) }, reqId: Date.now().toString() })
  }

  return (
    <div>
      <div className="page-header">
        <h1>签到</h1>
        <span style={{ color: connected ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
          {connected ? '● 已连接' : '○ 未连接'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Check-in */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            {checkInResult?.success ? '签到成功' : '扫码签到'}
          </h3>

          {checkInResult?.success ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <CheckCircle size={64} style={{ color: 'var(--success)', marginBottom: 12 }} />
              <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>签到成功</div>
              <StatusBadge status={checkInResult.status} />
              <div style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { setCheckInResult(null); setManualToken(''); setSessionId('') }}>继续签到</button>
            </div>
          ) : (
            <>
              {showScanner ? (
                <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <button className="btn-primary" onClick={() => setShowScanner(true)} style={{ marginBottom: 16 }}>
                    <Camera size={16} style={{ marginRight: 4 }} />打开摄像头扫码
                  </button>
                  <div style={{ margin: '16px 0', color: 'var(--text-secondary)', fontSize: 13 }}>或手动输入签到码</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <input placeholder="会话ID" value={sessionId} onChange={e => setSessionId(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <input placeholder="签到码" value={manualToken} onChange={e => setManualToken(e.target.value)} />
                      </div>
                    </div>
                    <button className="btn-primary" onClick={handleManualCheckIn} style={{ alignSelf: 'flex-end' }}>
                      <Keyboard size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Stats */}
        <div>
          {monthStats && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                本月出勤统计
              </h3>
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="label">出勤天数</div>
                  <div className="value" style={{ color: 'var(--success)', fontSize: 24 }}>{monthStats.present || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="label">迟到次数</div>
                  <div className="value" style={{ color: 'var(--warning)', fontSize: 24 }}>{monthStats.late || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="label">缺勤次数</div>
                  <div className="value" style={{ color: 'var(--danger)', fontSize: 24 }}>{monthStats.absent || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="label">出勤率</div>
                  <div className="value" style={{ color: 'var(--primary)', fontSize: 24 }}>
                    {monthStats.rate ? `${Math.round(monthStats.rate)}%` : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>最近签到记录</h3>
            {recentRecords.length === 0 ? (
              <div className="empty">暂无记录</div>
            ) : (
              recentRecords.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.course_name || r.session?.course_name || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.date || r.session?.date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={r.status} />
                    {r.check_in_time && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <Clock size={12} style={{ verticalAlign: 'middle' }} /> {format(new Date(r.check_in_time), 'HH:mm')}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
