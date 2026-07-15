async function getCourses() {
  const response = await fetch('/api/materials/courses');
  if (!response.ok) throw new Error('Could not load courses');
  const result = await response.json();
  return result.courses || [];
}

async function getMaterials() {
  const response = await fetch('/api/materials');
  if (!response.ok) throw new Error('Could not load materials');
  const result = await response.json();
  return result.materials || [];
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

  return response.json();
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
