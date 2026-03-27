import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, createSession, startSession, endSession, cancelSession } from '../api/sessions'
import { getCourses } from '../api/courses'
import { getClasses } from '../api/classes'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import DatePicker from '../components/DatePicker'
import { Plus, Play, Square, X, Eye, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [courses, setCourses] = useState([])
  const [classList, setClassList] = useState([])
  const [dateFilter, setDateFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    course_id: '', class_id: '', date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00', end_time: '09:40', location: '', description: ''
  })

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFilter) params.date = dateFilter
      if (courseFilter) params.course_id = courseFilter
      if (statusFilter) params.status = statusFilter
      const res = await getSessions(params)
      setSessions(res.data.data?.items || res.data.data || [])
    } catch { toast.addToast('获取会话列表失败', 'error') }
    finally { setLoading(false) }
  }, [dateFilter, courseFilter, statusFilter, toast])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  useEffect(() => {
    if (showModal) {
      getCourses().then(r => setCourses(r.data.data?.items || r.data.data || []))
      getClasses().then(r => setClassList(r.data.data?.items || r.data.data || []))
    }
  }, [showModal])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await createSession(form)
      toast.addToast('签到会话创建成功', 'success')
      setShowModal(false); fetchSessions()
    } catch (e) { toast.addToast(e.response?.data?.message || '创建失败', 'error') }
  }

  const handleStart = async (id) => {
    try { await startSession(id); toast.addToast('签到已开始', 'success'); fetchSessions(); navigate(`/sessions/${id}/active`) }
    catch (e) { toast.addToast(e.response?.data?.message || '启动失败', 'error') }
  }

  const handleEnd = async (id) => {
    if (!confirm('确定结束签到？')) return
    try { await endSession(id); toast.addToast('签到已结束', 'success'); fetchSessions() }
    catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleCancel = async (id) => {
    if (!confirm('确定取消此会话？')) return
    try { await cancelSession(id); toast.addToast('已取消', 'success'); fetchSessions() }
    catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const columns = [
    { key: 'course_name', label: '课程', sortable: true },
    { key: 'class_name', label: '班级' },
    { key: 'date', label: '日期', sortable: true },
    { key: 'start_time', label: '开始时间' },
    { key: 'end_time', label: '结束时间' },
    { key: 'location', label: '地点' },
    { key: 'status', label: '状态', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'checked_in', label: '已签/总数', render: (r) => `${r.checked_in_count || 0}/${r.total_count || 0}` },
    { key: 'actions', label: '操作', render: (r) => (
      <div className="table-actions">
        {r.status === 'scheduled' && <button className="btn-sm btn-success" onClick={() => handleStart(r.id)} title="开始签到"><Play size={14} /></button>}
        {r.status === 'active' && (
          <>
            <button className="btn-sm btn-primary" onClick={() => navigate(`/sessions/${r.id}/active`)} title="查看"><Eye size={14} /></button>
            <button className="btn-sm btn-danger" onClick={() => handleEnd(r.id)} title="结束签到"><Square size={14} /></button>
          </>
        )}
        {(r.status === 'scheduled' || r.status === 'active') && <button className="btn-sm btn-secondary" onClick={() => handleCancel(r.id)} title="取消"><X size={14} /></button>}
        {r.status === 'ended' && <button className="btn-sm btn-secondary" onClick={() => navigate(`/attendance?session_id=${r.id}`)} title="查看记录"><Eye size={14} /></button>}
      </div>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>签到会话</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} style={{ marginRight: 4 }} />创建会话
        </button>
      </div>

      <div className="filter-bar">
        <DatePicker value={dateFilter} onChange={setDateFilter} label="" />
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
          <option value="">全部课程</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="scheduled">已排课</option>
          <option value="active">进行中</option>
          <option value="ended">已结束</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      <div className="card">
        <DataTable columns={columns} data={sessions} loading={loading} />
      </div>

      {showModal && (
        <Modal title="创建签到会话" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate}>
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
            <div className="form-group">
              <label>日期</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>开始时间</label>
                <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>结束时间</label>
                <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>地点</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label>备注</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button type="submit" className="btn-primary">创建</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
