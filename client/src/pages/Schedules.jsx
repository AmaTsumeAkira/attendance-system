import { useState, useEffect, useCallback } from 'react'
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, generateSessions } from '../api/schedules'
import { getCourses } from '../api/courses'
import { getClasses } from '../api/classes'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { Plus, Edit2, Trash2, Zap, Calendar } from 'lucide-react'
import { format } from 'date-fns'

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const PERIODS = [
  { label: '第1-2节', start: '08:00', end: '09:40' },
  { label: '第3-4节', start: '10:00', end: '11:40' },
  { label: '第5-6节', start: '14:00', end: '15:40' },
  { label: '第7-8节', start: '16:00', end: '17:40' },
  { label: '第9-10节', start: '19:00', end: '20:40' },
]

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [courses, setCourses] = useState([])
  const [classList, setClassList] = useState([])
  const toast = useToast()
  const [form, setForm] = useState({ course_id: '', class_id: '', day_of_week: 1, period: 0, semester: '', location: '' })
  const [genForm, setGenForm] = useState({ semester: '', startDate: '', endDate: '' })

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try { const res = await getSchedules(); setSchedules(res.data.data?.items || res.data.data || []) }
    catch { toast.addToast('获取课表失败', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  useEffect(() => {
    if (showModal || showGenerate) {
      getCourses().then(r => setCourses(r.data.data?.items || r.data.data || []))
      getClasses().then(r => setClassList(r.data.data?.items || r.data.data || []))
    }
  }, [showModal, showGenerate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const p = PERIODS[form.period]
      await createSchedule({
        course_id: form.course_id, class_id: form.class_id,
        day_of_week: form.day_of_week, start_time: p.start, end_time: p.end,
        semester: form.semester, location: form.location
      })
      toast.addToast('课表创建成功', 'success')
      setShowModal(false); fetchSchedules()
    } catch (e) { toast.addToast(e.response?.data?.message || '创建失败', 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定删除此课表？')) return
    try { await deleteSchedule(id); toast.addToast('已删除', 'success'); fetchSchedules() }
    catch (e) { toast.addToast(e.response?.data?.message || '删除失败', 'error') }
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    try {
      const res = await generateSessions(genForm)
      toast.addToast(`已生成 ${res.data.data?.count || 0} 个签到会话`, 'success')
      setShowGenerate(false)
    } catch (e) { toast.addToast(e.response?.data?.message || '生成失败', 'error') }
  }

  // Build week grid
  const grid = {}
  schedules.forEach(s => {
    const key = `${s.day_of_week}-${s.start_time}`
    grid[key] = s
  })

  return (
    <div>
      <div className="page-header">
        <h1>课表管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setShowGenerate(true)}>
            <Zap size={16} style={{ marginRight: 4 }} />批量生成会话
          </button>
          <button className="btn-primary" onClick={() => { setForm({ course_id: '', class_id: '', day_of_week: 1, period: 0, semester: '', location: '' }); setShowModal(true) }}>
            <Plus size={16} style={{ marginRight: 4 }} />添加课表
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th style={{ width: 100 }}>节次</th>
              {DAYS.map((d, i) => <th key={i}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p, pi) => (
              <tr key={pi}>
                <td style={{ fontWeight: 600, fontSize: 13 }}>{p.label}<br /><span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{p.start}-{p.end}</span></td>
                {DAYS.map((_, di) => {
                  const key = `${di + 1}-${p.start}`
                  const s = grid[key]
                  return (
                    <td key={di} style={{ padding: 4, verticalAlign: 'top' }}>
                      {s ? (
                        <div style={{ background: 'var(--primary-light)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{s.course_name}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{s.class_name}</div>
                          {s.location && <div style={{ color: 'var(--text-secondary)' }}>📍{s.location}</div>}
                          <button className="btn-sm btn-danger" style={{ marginTop: 4, padding: '2px 6px', fontSize: 10 }} onClick={() => handleDelete(s.id)}>删除</button>
                        </div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="添加课表" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>课程</label>
                <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })} required>
                  <option value="">请选择</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>班级</label>
                <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} required>
                  <option value="">请选择</option>
                  {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>星期</label>
                <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: parseInt(e.target.value) })}>
                  {DAYS.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>节次</label>
                <select value={form.period} onChange={e => setForm({ ...form, period: parseInt(e.target.value) })}>
                  {PERIODS.map((p, i) => <option key={i} value={i}>{p.label} ({p.start}-{p.end})</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>学期</label>
                <input value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} placeholder="如 2025-S" />
              </div>
              <div className="form-group">
                <label>地点</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button type="submit" className="btn-primary">添加</button>
            </div>
          </form>
        </Modal>
      )}

      {showGenerate && (
        <Modal title="批量生成签到会话" onClose={() => setShowGenerate(false)}>
          <form onSubmit={handleGenerate}>
            <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
              根据课表模板，在指定时间范围内自动生成签到会话
            </p>
            <div className="form-group">
              <label>学期</label>
              <input value={genForm.semester} onChange={e => setGenForm({ ...genForm, semester: e.target.value })} required placeholder="如 2025-S" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>开始日期</label>
                <input type="date" value={genForm.startDate} onChange={e => setGenForm({ ...genForm, startDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>结束日期</label>
                <input type="date" value={genForm.endDate} onChange={e => setGenForm({ ...genForm, endDate: e.target.value })} required />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowGenerate(false)}>取消</button>
              <button type="submit" className="btn-primary"><Zap size={14} style={{ marginRight: 4 }} />生成</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
