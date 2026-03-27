import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getLeaves, createLeave, reviewLeave, cancelLeave } from '../api/leaves'
import { useToast } from '../components/Toast'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { Plus, Check, X, FileText } from 'lucide-react'
import { format } from 'date-fns'

export default function Leaves() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'teacher'
  const [leaves, setLeaves] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showReview, setShowReview] = useState(null)
  const [reviewComment, setReviewComment] = useState('')
  const toast = useToast()
  const limit = 20

  const [form, setForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '', reason: '', type: 'personal' })

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit }
      if (statusFilter) params.status = statusFilter
      if (!isAdmin) params.user_id = user.id
      const res = await getLeaves(params)
      const data = res.data.data
      setLeaves(data?.items || [])
      setTotal(data?.total || 0)
    } catch { toast.addToast('获取请假列表失败', 'error') }
    finally { setLoading(false) }
  }, [page, statusFilter, isAdmin, user, toast])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createLeave(form)
      toast.addToast('请假申请已提交', 'success')
      setShowModal(false); setForm({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '', reason: '', type: 'personal' })
      fetchLeaves()
    } catch (e) { toast.addToast(e.response?.data?.message || '提交失败', 'error') }
  }

  const handleReview = async (status) => {
    try {
      await reviewLeave(showReview.id, { status, comment: reviewComment })
      toast.addToast(status === 'approved' ? '已批准' : '已拒绝', 'success')
      setShowReview(null); setReviewComment(''); fetchLeaves()
    } catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const handleCancel = async (id) => {
    if (!confirm('确定取消此请假申请？')) return
    try { await cancelLeave(id); toast.addToast('已取消', 'success'); fetchLeaves() }
    catch (e) { toast.addToast(e.response?.data?.message || '操作失败', 'error') }
  }

  const columns = [
    ...(isAdmin ? [{ key: 'user_name', label: '申请人', sortable: true }] : []),
    { key: 'type', label: '类型', render: (r) => {
      const map = { personal: '事假', sick: '病假', other: '其他' }
      return map[r.type] || r.type
    }},
    { key: 'start_date', label: '开始日期' },
    { key: 'end_date', label: '结束日期' },
    { key: 'reason', label: '原因', render: (r) => <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.reason}</span> },
    { key: 'status', label: '状态', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '操作', render: (r) => (
      <div className="table-actions">
        {isAdmin && r.status === 'pending' && (
          <>
            <button className="btn-sm btn-success" onClick={() => { setShowReview(r); setReviewComment('') }}><Check size={14} /></button>
            <button className="btn-sm btn-danger" onClick={() => { setShowReview(r); setReviewComment('') }}><X size={14} /></button>
          </>
        )}
        {!isAdmin && r.status === 'pending' && (
          <button className="btn-sm btn-danger" onClick={() => handleCancel(r.id)}>取消</button>
        )}
      </div>
    )},
  ]

  return (
    <div>
      <div className="page-header">
        <h1>{isAdmin ? '请假审批' : '请假申请'}</h1>
        {!isAdmin && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} style={{ marginRight: 4 }} />提交申请
          </button>
        )}
      </div>

      <div className="filter-bar">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          <option value="pending">待审批</option>
          <option value="approved">已批准</option>
          <option value="rejected">已拒绝</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      <div className="card">
        <DataTable columns={columns} data={leaves} loading={loading} page={page} total={total} limit={limit} onPageChange={setPage} />
      </div>

      {showModal && (
        <Modal title="提交请假申请" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>开始日期</label>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>结束日期</label>
                <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
              </div>
            </div>
            <div className="form-group">
              <label>请假类型</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="personal">事假</option>
                <option value="sick">病假</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="form-group">
              <label>请假原因</label>
              <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required placeholder="请输入请假原因" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button type="submit" className="btn-primary">提交</button>
            </div>
          </form>
        </Modal>
      )}

      {showReview && (
        <Modal title="审批请假申请" onClose={() => setShowReview(null)}>
          <div style={{ marginBottom: 16 }}>
            <p><strong>{showReview.user_name}</strong> 申请请假</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{showReview.start_date} 至 {showReview.end_date}</p>
            <p style={{ marginTop: 8 }}>{showReview.reason}</p>
          </div>
          <div className="form-group">
            <label>审批意见</label>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="可选" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn-danger" onClick={() => handleReview('rejected')}><X size={14} style={{ marginRight: 4 }} />拒绝</button>
            <button className="btn-success" onClick={() => handleReview('approved')}><Check size={14} style={{ marginRight: 4 }} />批准</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
