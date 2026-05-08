import JSZip from 'jszip'
import type { ImageItem } from './types'

export function isImagePath(path: string) {
  return /\.(jpe?g|png|webp|bmp|gif)$/i.test(path)
}

export function getImageMimeType(path: string) {
  const lowerPath = path.toLowerCase()

  if (lowerPath.endsWith('.png')) return 'image/png'
  if (lowerPath.endsWith('.webp')) return 'image/webp'
  if (lowerPath.endsWith('.bmp')) return 'image/bmp'
  if (lowerPath.endsWith('.gif')) return 'image/gif'

  return 'image/jpeg'
}

export function getFileName(path: string) {
  return path.split('/').pop() || 'image'
}

export function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

export function getOutputPath(inputPath: string, targetSizeKB: number) {
  const parts = inputPath.split('/').filter(Boolean)
  const filename = parts.pop() || 'image'
  const outputName = `${stripExtension(filename) || 'image'}-compressed-${targetSizeKB}kb.jpg`

  return [...parts, outputName].join('/')
}

export function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readImagesFromZip(file: File): Promise<ImageItem[]> {
  const zip = await JSZip.loadAsync(file)
  const entries = Object.values(zip.files).filter(entry => !entry.dir && isImagePath(entry.name))
  const images: ImageItem[] = []

  for (const entry of entries) {
    const blob = await entry.async('blob')
    images.push({
      file: new File([blob], getFileName(entry.name), { type: getImageMimeType(entry.name) }),
      name: entry.name,
    })
  }

  return images
}

export async function buildZip(results: Array<{ blob: Blob, source: ImageItem }>, targetSizeKB: number) {
  const zip = new JSZip()

  for (const result of results) {
    zip.file(getOutputPath(result.source.name, targetSizeKB), result.blob)
  }

  return zip.generateAsync({ type: 'blob' })
}