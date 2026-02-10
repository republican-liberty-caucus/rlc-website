/** Upload a file to the admin upload endpoint and return its public URL. */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/v1/admin/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  const data = await res.json();

  if (!data.url || typeof data.url !== 'string') {
    throw new Error('Upload succeeded but no URL was returned');
  }

  return data.url;
}
