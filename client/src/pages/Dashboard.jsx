import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getOverview } from '../api/stats'
import { getAttendances } from '../api/attendance'
import { getMyAttendance } from '../api/attendance'
import { format } from 'date-fns'
import { Users, UserCheck, Clock, UserX, FileText } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'teacher'
  const [overview, setOverview] = useState(null)
  const [recent, setRecent] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        if (isAdmin) {
          const res = await getOverview({ date: today })
          setOverview(res.data.data)
        }
        // Fetch recent attendances
        if (isAdmin) {
          const res = await getAttendances({ limit: 10, page: 1 })
          setRecent(res.data.data?.items || [])
        } else {
          const res = await getMyAttendance()
          const items = res.data.data?.items || res.data.data || []
          setRecent(Array.isArray(items) ? items.slice(0, 10) : [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [isAdmin, today])

  // Generate mock trend data for the chart
  useEffect(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push({
        date: format(d, 'MM/dd'),
        出勤率: Math.round(85 + Math.random() * 10),
        签到人数: Math.round(30 + Math.random() * 20),
      })
    }
    setTrend(days)
  }, [])

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <h1>仪表盘</h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{format(new Date(), 'yyyy年MM月dd日')}</span>
      </div>

      {isAdmin && overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label"><Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />总人数</div>
            <div className="value" style={{ color: 'var(--primary)' }}>{overview.total || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label"><UserCheck size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />已签到</div>
            <div className="value" style={{ color: 'var(--success)' }}>{overview.present || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />迟到</div>
            <div className="value" style={{ color: 'var(--warning)' }}>{overview.late || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label"><UserX size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />缺勤</div>
            <div className="value" style={{ color: 'var(--danger)' }}>{overview.absent || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label"><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />请假</div>
            <div className="value" style={{ color: 'var(--info)' }}>{overview.leave || 0}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>本周出勤趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="出勤率" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="签到人数" stroke="var(--success)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>出勤率</h3>
          {overview && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--primary)' }}>
                {overview.total > 0 ? Math.round(((overview.present || 0) + (overview.late || 0)) / overview.total * 100) : 0}%
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>今日出勤率</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>最近签到活动</h3>
        {recent.length === 0 ? (
          <div className="empty">暂无签到记录</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>课程</th>
                  <th>时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={r.id || i}>
                    <td>{r.user?.real_name || r.user_name || r.user_id}</td>
                    <td>{r.session?.course_name || r.course_name || '-'}</td>
                    <td>{r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm:ss') : '-'}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
