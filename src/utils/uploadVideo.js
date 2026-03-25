export async function uploadVideo(file) {
  const url = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)

  const res = await fetch(url, { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Video upload failed')

  const data = await res.json()
  return data.secure_url
}
