export default function DatePicker({ value, onChange, label, ...props }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label>{label}</label>}
      <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  )
}
