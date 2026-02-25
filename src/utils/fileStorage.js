/**
 * Patient files (xray + photos) — localStorage-based.
 * Files are stored as base64 dataURLs inside each entry.
 * Key: dental_clinic_patient_files
 *
 * Entry shape:
 * {
 *   id, patientId, visitId, toothNumber,
 *   fileType,      // 'xray_pritsel' | 'xray_optg' | 'xray_klkt' | 'photo_before' | 'photo_during' | 'photo_after'
 *   category,      // 'before' | 'during' | 'after'
 *   mimeType,      // 'image/jpeg' | 'image/png' | 'application/pdf'
 *   name,          // original file name
 *   dataUrl,       // base64 data URL
 *   description,
 *   uploadedBy,    // userId
 *   uploadedByName,
 *   createdAt,
 * }
 */

const FILES_KEY = 'dental_clinic_patient_files';

export function getAllFiles() {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAllFiles(files) {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch (e) {
    // Storage quota exceeded — alert caller
    throw new Error('QUOTA_EXCEEDED');
  }
}

export function getFilesForVisit(patientId, visitId) {
  return getAllFiles().filter(
    f => f.patientId === String(patientId) && f.visitId === String(visitId)
  );
}

export function getFilesForPatient(patientId) {
  return getAllFiles().filter(f => f.patientId === String(patientId));
}

export function addFile({ patientId, visitId, toothNumber, fileType, category, mimeType, name, dataUrl, description, uploadedBy, uploadedByName }) {
  const files = getAllFiles();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    patientId: String(patientId || ''),
    visitId: String(visitId || ''),
    toothNumber: toothNumber || '',
    fileType: fileType || 'photo_before',
    category: category || 'before',
    mimeType: mimeType || 'image/jpeg',
    name: name || '',
    dataUrl: dataUrl || '',
    description: description || '',
    uploadedBy: String(uploadedBy || ''),
    uploadedByName: uploadedByName || '',
    createdAt: new Date().toISOString(),
  };
  files.push(entry);
  saveAllFiles(files);
  return entry;
}

export function deleteFile(id) {
  const files = getAllFiles().filter(f => f.id !== id);
  saveAllFiles(files);
}

export function updateFileDescription(id, description) {
  const files = getAllFiles().map(f => f.id === id ? { ...f, description } : f);
  saveAllFiles(files);
}

/**
 * Read a File object and return a base64 dataURL Promise.
 * Rejects with 'FILE_TOO_LARGE' if > 5MB.
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('FILE_TOO_LARGE'));
      return;
    }
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('READ_ERROR'));
    reader.readAsDataURL(file);
  });
}
