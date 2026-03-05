import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import FormError from '../components/FormError';

const ENTITIES = [
  { id: 'students', label: 'Students' },
  { id: 'staff', label: 'Staff' },
  { id: 'users', label: 'Users' },
  { id: 'courses', label: 'Courses / Subjects' },
  { id: 'timetable', label: 'Timetable slots' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'fees', label: 'Fee collections' },
  { id: 'exams', label: 'Exams' },
  { id: 'subject_faculty', label: 'Subject–Faculty mapping' },
  { id: 'semesters', label: 'Semesters' },
  { id: 'holidays', label: 'Holidays' },
];

export default function BulkUpload() {
  const toast = useToast();
  const [entity, setEntity] = useState('students');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    setError('');
    setResult(null);
    setFile(null);
    api.bulkUpload
      .template(entity)
      .then((r) => setColumns(r.columns || []))
      .catch((e) => setError(e.message));
  }, [entity]);

  const onUpload = () => {
    if (!file) {
      setError('Select an Excel (.xlsx) file');
      return;
    }
    const fn = (file.name || '').toLowerCase();
    if (!fn.endsWith('.xlsx') && !fn.endsWith('.csv')) {
      setError('Only .xlsx or .csv files are allowed');
      return;
    }
    setUploading(true);
    setError('');
    setResult(null);
    api.bulkUpload
      .upload(entity, file)
      .then((r) => {
        setResult(r);
        toast.success(`Imported: ${r.created} created, ${r.updated} updated`);
      })
      .catch((e) => {
        setError(e.message);
        toast.error(e.message);
      })
      .finally(() => setUploading(false));
  };

  return (
    <div className="bulk-upload-page">
      <h2 className="page-title">Bulk Excel upload</h2>
      <p className="dashboard-welcome">
        Upload an Excel (.xlsx) or CSV file to bulk insert or update records. First row must be column headers (match the names below). Max file size 10MB.
      </p>
      <FormError message={error} onDismiss={() => setError('')} />

      <div className="bulk-upload-form card">
        <div className="form-row">
          <label>Table / Entity</label>
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            {ENTITIES.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Expected columns (use these as first row in Excel)</label>
          <div className="bulk-upload-columns">
            {columns.length ? columns.join(', ') : 'Loading…'}
          </div>
        </div>
        <div className="form-row">
          <label>Excel or CSV file (.xlsx, .csv)</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bulk-upload-result card">
          <h3>Result</h3>
          <p><strong>Created:</strong> {result.created} &nbsp; <strong>Updated:</strong> {result.updated} &nbsp; <strong>Total rows:</strong> {result.total_rows}</p>
          {result.message && <p>{result.message}</p>}
          {result.errors && result.errors.length > 0 && (
            <div className="bulk-upload-errors">
              <h4>Errors (first 100)</h4>
              <table>
                <thead><tr><th>Row</th><th>Message</th></tr></thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr key={i}><td>{err.row}</td><td>{err.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
