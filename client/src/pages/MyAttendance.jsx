import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getMyAttendance } from '../api/attendance'
import { getStudentStats } from '../api/stats'
import { useToast } from '../components/Toast'
import StatusBadge from '../components/StatusBadge'
import DataTable from '../components/DataTable'
import { Calendar, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

export default function MyAttendance() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [monthStats, setMonthStats] = useState(null)
  const toast = useToast()
  const limit = 20

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const res = await getMyAttendance()
        const items = res.data.data?.items || res.data.data || []
        setRecords(Array.isArray(items) ? items : [])
        setTotal(Array.isArray(items) ? items.length : 0)
      } catch { toast.addToast('获取记录失败', 'error') }
      finally { setLoading(false) }
      try {
        const month = format(new Date(), 'yyyy-MM')
        const res = await getStudentStats(user.id, { month })
        setMonthStats(res.data.data)
      } catch {}
    }
    fetch()
  }, [user, toast])

  const columns = [
    { key: 'course_name', label: '课程', sortable: true },
    { key: 'class_name', label: '班级' },
    { key: 'date', label: '日期', sortable: true },
    { key: 'check_in_time', label: '签到时间', render: (r) => r.check_in_time ? format(new Date(r.check_in_time), 'HH:mm:ss') : '-' },
    { key: 'status', label: '状态', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const paged = records.slice((page - 1) * limit, page * limit)

  return (
    <div>
      <div className="page-header">
        <h1>我的出勤</h1>
      </div>

      {monthStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="label"><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />本月出勤</div>
            <div className="value" style={{ color: 'var(--success)' }}>{monthStats.present || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">迟到</div>
            <div className="value" style={{ color: 'var(--warning)' }}>{monthStats.late || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">缺勤</div>
            <div className="value" style={{ color: 'var(--danger)' }}>{monthStats.absent || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label"><TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />出勤率</div>
            <div className="value" style={{ color: 'var(--primary)' }}>
              {monthStats.rate ? `${Math.round(monthStats.rate)}%` : '-'}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={paged} loading={loading} page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>
    </div>
  )
}
