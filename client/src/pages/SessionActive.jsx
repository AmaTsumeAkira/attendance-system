import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession, endSession } from '../api/sessions'
import { updateAttendance, manualUpdateAttendance, getAttendances } from '../api/attendance'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket } from '../hooks/useWebSocket'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import QRCodeDisplay from '../components/QRCodeDisplay'
import StatusBadge from '../components/StatusBadge'
import { Square, RefreshCw, UserCheck, Clock, Edit3 } from 'lucide-react'
import { format } from 'date-fns'

export default function SessionActive() {
  const { id } = useParams()
  const { token } = useAuth()
  const { send, addListener, connected } = useWebSocket(token)
  const toast = useToast()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ checkedIn: 0, total: 0, recentUsers: [] })
  const [qrToken, setQrToken] = useState('')
  const [records, setRecords] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [newStatus, setNewStatus] = useState('present')
  const [remark, setRemark] = useState('')
  const intervalRef = useRef(null)

  // Fetch attendance records for the session
  const fetchRecords = async () => {
    try {
      const res = await getAttendances({ session_id: id, limit: 200 })
      setRecords(res.data.data?.items || [])
    } catch {}
  }

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await getSession(id)
        const s = res.data.data
        setSession(s)
        setStats({ checkedIn: s.checked_in_count || 0, total: s.total_count || 0, recentUsers: s.recent_users || [] })
        if (s.qr_token) setQrToken(s.qr_token)
      // Fetch attendance records
      await fetchRecords()
      } catch { toast.addToast('获取会话信息失败', 'error') }
      finally { setLoading(false) }
    }
    fetchSession()
  }, [id, toast])

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!connected) return
    send({ type: 'subscribe', payload: { sessionId: parseInt(id) } })

    const unsub = addListener('session-active', (msg) => {
      if (msg.type === 'user_checked_in') {
        setStats(prev => ({
          ...prev,
          checkedIn: prev.checkedIn + 1,
          recentUsers: [{ userId: msg.payload.userId, name: msg.payload.name, status: msg.payload.status, time: msg.payload.time }, ...prev.recentUsers].slice(0, 20)
        }))
      }
      if (msg.type === 'session_update') {
        setStats(prev => ({ ...prev, checkedIn: msg.payload.checkedIn, total: msg.payload.total }))
      }
    })

    return () => { unsub() }
  }, [connected, id, send, addListener])

  // Refresh QR token periodically
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      send({ type: 'get_stats', payload: { sessionId: parseInt(id) } })
    }, 5000)
    return () => clearInterval(intervalRef.current)
  }, [id, send])

  const handleEnd = async () => {
    if (!confirm('确定结束签到？')) return
    try {
      await endSession(id)
      toast.addToast('签到已结束', 'success')
      navigate('/sessions')
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleOpenModal = (record) => {
    setSelectedRecord(record)
    setNewStatus('present')
    setRemark('')
    setModalOpen(true)
  }

  const handleSubmitManualUpdate = async () => {
    if (!selectedRecord) return
    try {
      await manualUpdateAttendance(selectedRecord.id, { status: newStatus, remark })
      toast.addToast('补签成功', 'success')
      setModalOpen(false)
      setSelectedRecord(null)
      fetchRecords()
      send({ type: 'get_stats', payload: { sessionId: parseInt(id) } })
    } catch (e) {
      toast.addToast(e.response?.data?.message || '补签失败', 'error')
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>
  if (!session) return <div className="empty">会话不存在</div>

  const progress = stats.total > 0 ? Math.round(stats.checkedIn / stats.total * 100) : 0

  return (
    <div>
      <div className="page-header">
        <h1>{session.course_name || '签到会话'}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: connected ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
            {connected ? '● 已连接' : '○ 未连接'}
          </span>
          <button className="btn-danger" onClick={handleEnd}><Square size={16} style={{ marginRight: 4 }} />结束签到</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: QR Code */}
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>扫码签到</h3>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <QRCodeDisplay value={qrToken || session.qr_token || 'waiting'} size={280} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {session.date} {session.start_time} - {session.end_time}
            {session.location && ` | ${session.location}`}
          </div>
        </div>

        {/* Right: Stats */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>签到进度</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{stats.checkedIn}</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', alignSelf: 'flex-end' }}>/ {stats.total} 人</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progress > 80 ? 'var(--success)' : progress > 50 ? 'var(--warning)' : 'var(--primary)' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>{progress}% 完成</div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>签到记录</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {records.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>等待学生签到...</div>
              ) : (
                records.map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', animation: 'slideIn .3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserCheck size={16} style={{ color: r.status === 'present' ? 'var(--success)' : r.status === 'late' ? 'var(--warning)' : 'var(--danger)' }} />
                      <span style={{ fontWeight: 500 }}>{r.real_name || r.user_id}</span>
                      {r.student_id && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.student_id}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge status={r.status} />
                      {r.check_in_time && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                          {format(new Date(r.check_in_time), 'HH:mm:ss')}
                        </span>
                      )}
                      <button
                        className="btn-icon btn-secondary"
                        title="修改状态"
                        onClick={() => handleOpenModal(r)}
                        style={{ padding: 4 }}
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Update Modal */}
      {modalOpen && (
        <Modal
          title="补签 / 修改状态"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
              <button className="btn-primary" onClick={handleSubmitManualUpdate}>确认</button>
            </>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>学生</div>
            <div style={{ fontWeight: 500 }}>{selectedRecord?.real_name} {selectedRecord?.student_id ? `(${selectedRecord.student_id})` : ''}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>当前状态</div>
            <StatusBadge status={selectedRecord?.status} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>新状态</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ width: '100%', padding: '8px 12px' }}>
              <option value="present">出勤</option>
              <option value="late">迟到</option>
              <option value="absent">缺勤</option>
              <option value="leave">请假</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>备注</label>
            <input type="text" value={remark} onChange={e => setRemark(e.target.value)} placeholder="补签原因..." style={{ width: '100%', padding: '8px 12px' }} />
          </div>
        </Modal>
      )}
    </div>
  )
}
