const MATERIALS_STORAGE_KEY = 'academic-materials';

function readMaterials() {
  try {
    const raw = window.localStorage.getItem(MATERIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Could not read academic materials from localStorage:', error);
    return [];
  }
}

function saveMaterials(items) {
  try {
    window.localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Could not save academic materials to localStorage:', error);
  }
}

async function getCourses() {
  const response = await fetch('/api/materials/courses');
  if (!response.ok) throw new Error('Could not load courses');
  const result = await response.json();
  return result.courses || [];
}

async function getMaterials() {
  try {
    const response = await fetch('/api/materials');
    if (!response.ok) throw new Error('Could not load materials');
    const result = await response.json();
    const materials = Array.isArray(result.materials) ? result.materials : [];
    saveMaterials(materials);
    return materials.slice().sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  } catch (error) {
    console.warn('Could not load materials from backend; using cached copy.', error);
    return readMaterials().slice().sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  }
}

async function uploadMaterial(payload, file) {
  const formData = new FormData();
  formData.append('course', payload.course);
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('category', payload.category);
  formData.append('dueDate', payload.dueDate || '');
  formData.append('professor', payload.professor || '');
  if (file) formData.append('file', file);

  const response = await fetch('/api/materials', { method: 'POST', body: formData });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Upload failed');
  }

  const data = await response.json();
  if (data?.material) {
    const existingMaterials = readMaterials();
    const nextMaterials = [data.material, ...existingMaterials.filter((item) => item.id !== data.material.id)];
    saveMaterials(nextMaterials);
  }

  return data;
}

async function deleteMaterial(id) {
  const response = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Delete failed');
  }

  return response.json();
}

function guessFileType(fileName) {
  const ext = fileName.split(".").pop().toUpperCase();
  return ext || "DOC";
}

function formatDate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
