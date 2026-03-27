import { useState, useEffect } from 'react'
import { getCourses } from '../api/courses'
import { getClasses } from '../api/classes'
import { getUsers } from '../api/users'
import { getClassStats, getCourseStats, getStudentStats } from '../api/stats'
import { useToast } from '../components/Toast'
import DatePicker from '../components/DatePicker'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import { format, subDays } from 'date-fns'

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']

export default function Stats() {
  const [dimension, setDimension] = useState('class')
  const [targetId, setTargetId] = useState('')
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState([])
  const [classList, setClassList] = useState([])
  const [students, setStudents] = useState([])
  const toast = useToast()

  useEffect(() => {
    getCourses().then(r => setCourses(r.data.data?.items || r.data.data || []))
    getClasses().then(r => setClassList(r.data.data?.items || r.data.data || []))
    getUsers({ role: 'student', limit: 200 }).then(r => setStudents(r.data.data?.items || []))
  }, [])

  useEffect(() => {
    if (!targetId) { setStats(null); return }
    const fetch = async () => {
      setLoading(true)
      try {
        let res
        if (dimension === 'class') res = await getClassStats(targetId, { start: startDate, end: endDate })
        else if (dimension === 'course') res = await getCourseStats(targetId, { start: startDate, end: endDate })
        else res = await getStudentStats(targetId, { month: startDate.slice(0, 7) })
        setStats(res.data.data)
      } catch { toast.addToast('获取统计数据失败', 'error') }
      finally { setLoading(false) }
    }
    fetch()
  }, [dimension, targetId, startDate, endDate, toast])

  const pieData = stats ? [
    { name: '出勤', value: stats.present || 0 },
    { name: '缺勤', value: stats.absent || 0 },
    { name: '迟到', value: stats.late || 0 },
    { name: '请假', value: stats.leave || 0 },
  ].filter(d => d.value > 0) : []

  const barData = stats?.daily ? stats.daily.map(d => ({
    date: d.date?.slice(5),
    出勤: d.present || 0,
    迟到: d.late || 0,
    缺勤: d.absent || 0,
    请假: d.leave || 0,
  })) : []

  const trendData = stats?.daily ? stats.daily.map(d => ({
    date: d.date?.slice(5),
    出勤率: d.total > 0 ? Math.round((d.present + d.late) / d.total * 100) : 0,
  })) : []

  const targetList = dimension === 'class' ? classList : dimension === 'course' ? courses : students
  const targetLabel = dimension === 'class' ? 'name' : 'name'

  return (
    <div>
      <div className="page-header">
        <h1>统计报表</h1>
      </div>

      <div className="filter-bar">
        <select value={dimension} onChange={e => { setDimension(e.target.value); setTargetId(''); setStats(null) }}>
          <option value="class">按班级</option>
          <option value="course">按课程</option>
          <option value="student">按学生</option>
        </select>
        <select value={targetId} onChange={e => setTargetId(e.target.value)}>
          <option value="">请选择</option>
          {targetList.map(t => <option key={t.id} value={t.id}>{t[targetLabel] || t.real_name || t.username}</option>)}
        </select>
        {dimension !== 'student' && (
          <>
            <DatePicker value={startDate} onChange={setStartDate} />
            <DatePicker value={endDate} onChange={setEndDate} />
          </>
        )}
        {dimension === 'student' && (
          <input type="month" value={startDate.slice(0, 7)} onChange={e => setStartDate(e.target.value + '-01')} />
        )}
      </div>

      {loading && <div className="loading"><div className="spinner" /></div>}

      {stats && !loading && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="label">总课次</div>
              <div className="value">{stats.total || stats.total_sessions || 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">出勤</div>
              <div className="value" style={{ color: 'var(--success)' }}>{stats.present || 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">迟到</div>
              <div className="value" style={{ color: 'var(--warning)' }}>{stats.late || 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">缺勤</div>
              <div className="value" style={{ color: 'var(--danger)' }}>{stats.absent || 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">出勤率</div>
              <div className="value" style={{ color: 'var(--primary)' }}>{stats.rate ? `${Math.round(stats.rate)}%` : '-'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>状态分布</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="empty">无数据</div>}
            </div>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>出勤率趋势</h3>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="出勤率" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="empty">无数据</div>}
            </div>
          </div>

          {barData.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>每日出勤详情</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="出勤" fill="#22c55e" stackId="a" />
                  <Bar dataKey="迟到" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="缺勤" fill="#ef4444" stackId="a" />
                  <Bar dataKey="请假" fill="#3b82f6" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {!stats && !loading && <div className="card"><div className="empty">请选择维度和目标查看统计</div></div>}
    </div>
  )
}
