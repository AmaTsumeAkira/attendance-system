import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export default function DataTable({ columns, data, loading, emptyText = '暂无数据', page, total, limit, onPageChange }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  let sorted = [...(data || [])]
  if (sortKey) {
    sorted.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null) return 1; if (bv == null) return -1
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const totalPages = limit ? Math.ceil((total || 0) / limit) : 1

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ cursor: col.sortable ? 'pointer' : 'default', minWidth: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}>
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} className="empty">{emptyText}</td></tr>
          ) : (
            sorted.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {page && total > 0 && (
        <div className="pagination">
          <button className="btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPageChange(1)}><ChevronsLeft size={14} /></button>
          <button className="btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>第 {page} / {totalPages} 页，共 {total} 条</span>
          <button className="btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight size={14} /></button>
          <button className="btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}><ChevronsRight size={14} /></button>
        </div>
      )}
    </div>
  )
}
