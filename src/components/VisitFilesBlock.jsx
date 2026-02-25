import { useState, useRef, useCallback } from 'react';
import { useLang } from '../context/LangContext';
import {
  getFilesForVisit, addFile, deleteFile, updateFileDescription, readFileAsDataUrl,
} from '../utils/fileStorage';

// Accepted MIME types
const ACCEPTED = 'image/jpeg,image/png,image/jpg,application/pdf';

// File type options with i18n key
const FILE_TYPES = [
  { value: 'xray_pritsel', labelKey: 'fileTypeXrayPritsel', category: 'before' },
  { value: 'xray_optg',    labelKey: 'fileTypeXrayOptg',    category: 'before' },
  { value: 'xray_klkt',    labelKey: 'fileTypeXrayKlkt',    category: 'before' },
  { value: 'photo_before', labelKey: 'fileTypePhotoBefore', category: 'before' },
  { value: 'photo_during', labelKey: 'fileTypePhotoDuring', category: 'during' },
  { value: 'photo_after',  labelKey: 'fileTypePhotoAfter',  category: 'after'  },
];

const CATEGORIES = [
  { value: 'before', labelKey: 'fileCatBefore' },
  { value: 'during', labelKey: 'fileCatDuring' },
  { value: 'after',  labelKey: 'fileCatAfter'  },
];

function isPdf(file) {
  return file.mimeType === 'application/pdf';
}

// ── Lightbox ─────────────────────────────────────────────────────
function Lightbox({ file, onClose, onDelete, canDelete }) {
  const { t } = useLang();
  if (!file) return null;

  function handleDownload() {
    const a = document.createElement('a');
    a.href = file.dataUrl;
    a.download = file.name || 'file';
    a.click();
  }

  return (
    <div className="vf-lightbox-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="vf-lightbox-box">
        <div className="vf-lightbox-toolbar">
          <div className="vf-lightbox-info">
            <span className="vf-lightbox-name">{file.name}</span>
            {file.description && (
              <span className="vf-lightbox-desc">{file.description}</span>
            )}
          </div>
          <div className="vf-lightbox-actions">
            <button className="vf-lb-btn" onClick={handleDownload} title={t('fileDownload')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t('fileDownload')}
            </button>
            {canDelete && (
              <button className="vf-lb-btn vf-lb-btn--danger" onClick={() => onDelete(file.id)} title={t('fileDelete')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                {t('fileDelete')}
              </button>
            )}
            <button className="vf-lb-btn vf-lb-btn--close" onClick={onClose} title={t('close')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="vf-lightbox-content">
          {isPdf(file) ? (
            <iframe
              src={file.dataUrl}
              className="vf-lightbox-pdf"
              title={file.name}
            />
          ) : (
            <img src={file.dataUrl} alt={file.name} className="vf-lightbox-img" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload form ───────────────────────────────────────────────────
function UploadForm({ onUpload, onCancel, t, lang }) {
  const [fileType, setFileType] = useState('photo_before');
  const [toothNumber, setToothNumber] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t('fileTooBig'));
      return;
    }
    setSelectedFile(file);
    setError('');
    if (file.type !== 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit() {
    if (!selectedFile) { setError(t('fileRequired')); return; }
    setUploading(true);
    setError('');
    try {
      const dataUrl = await readFileAsDataUrl(selectedFile);
      const ft = FILE_TYPES.find(f => f.value === fileType);
      onUpload({
        fileType,
        category: ft ? ft.category : 'before',
        mimeType: selectedFile.type,
        name: selectedFile.name,
        dataUrl,
        description,
        toothNumber,
      });
    } catch (e) {
      if (e.message === 'QUOTA_EXCEEDED') {
        setError(t('fileQuotaExceeded'));
      } else if (e.message === 'FILE_TOO_LARGE') {
        setError(t('fileTooBig'));
      } else {
        setError(t('fileUploadError'));
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="vf-upload-form">
      <div className="vf-upload-form-grid">
        {/* File picker */}
        <div className="form-group vf-file-picker-wrap">
          <label>{t('fileSelect')}</label>
          <div
            className={`vf-drop-zone${selectedFile ? ' vf-drop-zone--selected' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const fakeEvt = { target: { files: [file] } };
                handleFileChange(fakeEvt);
              }
            }}
          >
            {preview ? (
              <img src={preview} alt="preview" className="vf-drop-preview" />
            ) : selectedFile ? (
              <div className="vf-drop-pdf-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>{selectedFile.name}</span>
              </div>
            ) : (
              <div className="vf-drop-hint">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>{t('fileDrop')}</span>
                <span className="vf-drop-hint-sub">JPG, PNG, PDF — {t('fileMaxSize')}</span>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Options */}
        <div className="vf-upload-options">
          <div className="form-group">
            <label>{t('fileType')}</label>
            <select value={fileType} onChange={e => setFileType(e.target.value)}>
              {FILE_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{t(ft.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{t('diagTooth')} ({t('optional')})</label>
            <input
              type="text"
              placeholder={t('diagToothPh')}
              value={toothNumber}
              maxLength={2}
              onChange={e => setToothNumber(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>{t('fileDescription')} ({t('optional')})</label>
            <input
              type="text"
              placeholder={t('fileDescriptionPh')}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="vf-upload-error">{error}</div>}

      <div className="vf-upload-btns">
        <button className="btn-nav" onClick={onCancel}>{t('cancelEdit')}</button>
        <button
          className="btn-save"
          onClick={handleSubmit}
          disabled={uploading || !selectedFile}
        >
          {uploading ? t('fileUploading') : t('fileUpload')}
        </button>
      </div>
    </div>
  );
}

// ── Thumbnail card ────────────────────────────────────────────────
function ThumbCard({ file, onClick, onDelete, canDelete, t }) {
  return (
    <div className="vf-thumb" onClick={() => onClick(file)}>
      <div className="vf-thumb-img-wrap">
        {isPdf(file) ? (
          <div className="vf-thumb-pdf">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span className="vf-thumb-pdf-label">PDF</span>
          </div>
        ) : (
          <img src={file.dataUrl} alt={file.name} className="vf-thumb-img" />
        )}
        <div className="vf-thumb-overlay">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
      </div>
      <div className="vf-thumb-meta">
        <span className="vf-thumb-type">{t(FILE_TYPES.find(f => f.value === file.fileType)?.labelKey || 'fileTypePhotoBefore')}</span>
        {file.toothNumber && (
          <span className="vf-thumb-tooth">{t('diagTooth')}: {file.toothNumber}</span>
        )}
        {file.description && (
          <span className="vf-thumb-desc">{file.description}</span>
        )}
      </div>
      {canDelete && (
        <button
          className="vf-thumb-del"
          onClick={e => { e.stopPropagation(); onDelete(file.id); }}
          title={t('fileDelete')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function VisitFilesBlock({ patientId, visitId, session }) {
  const { t, lang } = useLang();
  const [files, setFiles] = useState(() => getFilesForVisit(patientId, visitId));
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxFile, setLightboxFile] = useState(null);
  const [activeCat, setActiveCat] = useState('all');

  const canDelete = session?.role === 'admin' || true; // author check done in onDelete
  const isAdmin = session?.role === 'admin';

  const refresh = useCallback(() => {
    setFiles(getFilesForVisit(patientId, visitId));
  }, [patientId, visitId]);

  function handleUpload(data) {
    try {
      addFile({
        patientId,
        visitId,
        ...data,
        uploadedBy: session?.id || '',
        uploadedByName: session?.name || session?.login || '',
      });
      refresh();
      setShowUpload(false);
    } catch (e) {
      alert(e.message === 'QUOTA_EXCEEDED' ? t('fileQuotaExceeded') : t('fileUploadError'));
    }
  }

  function handleDelete(id) {
    const file = files.find(f => f.id === id);
    if (!file) return;
    // Only admin or uploader can delete
    if (!isAdmin && file.uploadedBy !== String(session?.id || '')) {
      alert(t('fileDeleteNoAccess'));
      return;
    }
    if (!window.confirm(t('fileDeleteConfirm'))) return;
    deleteFile(id);
    refresh();
    if (lightboxFile?.id === id) setLightboxFile(null);
  }

  // Filter by category
  const filtered = activeCat === 'all'
    ? files
    : files.filter(f => f.category === activeCat);

  // Group counts
  const counts = { all: files.length };
  CATEGORIES.forEach(c => { counts[c.value] = files.filter(f => f.category === c.value).length; });

  return (
    <div className="vf-root">
      {/* Section header */}
      <div className="vf-header">
        <div className="vf-header-left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>{t('filesTitle')}</span>
          {files.length > 0 && (
            <span className="vf-count-badge">{files.length}</span>
          )}
        </div>
        <button
          className="vf-add-btn"
          onClick={() => setShowUpload(s => !s)}
        >
          {showUpload ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              {t('cancelEdit')}
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t('fileAddBtn')}
            </>
          )}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <UploadForm
          onUpload={handleUpload}
          onCancel={() => setShowUpload(false)}
          t={t}
          lang={lang}
        />
      )}

      {/* Category filter tabs */}
      {files.length > 0 && (
        <div className="vf-cat-tabs">
          <button
            className={`vf-cat-tab${activeCat === 'all' ? ' vf-cat-tab--active' : ''}`}
            onClick={() => setActiveCat('all')}
          >
            {t('fileCatAll')} ({counts.all})
          </button>
          {CATEGORIES.map(c => counts[c.value] > 0 && (
            <button
              key={c.value}
              className={`vf-cat-tab${activeCat === c.value ? ' vf-cat-tab--active' : ''}`}
              onClick={() => setActiveCat(c.value)}
            >
              {t(c.labelKey)} ({counts[c.value]})
            </button>
          ))}
        </div>
      )}

      {/* Thumbnails grid */}
      {files.length === 0 && !showUpload && (
        <div className="vf-empty">{t('filesEmpty')}</div>
      )}

      {filtered.length > 0 && (
        <div className="vf-grid">
          {filtered.map(file => (
            <ThumbCard
              key={file.id}
              file={file}
              onClick={setLightboxFile}
              onDelete={handleDelete}
              canDelete={isAdmin || file.uploadedBy === String(session?.id || '')}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && (
        <Lightbox
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
          onDelete={id => { handleDelete(id); setLightboxFile(null); }}
          canDelete={isAdmin || lightboxFile.uploadedBy === String(session?.id || '')}
        />
      )}
    </div>
  );
}
