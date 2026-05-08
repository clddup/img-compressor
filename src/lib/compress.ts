import type { CompressionResult } from './types'

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片无法读取'))
    }
    image.src = url
  })
}

function getCanvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('图片导出失败'))
    }, 'image/jpeg', quality)
  })
}

export async function compressImage(file: File, targetSizeBytes: number): Promise<CompressionResult | null> {
  const image = await loadImage(file)
  let currentScale = 1.0
  let finalBlob: Blob | null = null
  let finalQuality = 0
  let finalWidth = image.width
  let finalHeight = image.height

  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')

  if (!tempCtx) {
    throw new Error('当前浏览器不支持 Canvas')
  }

  while (currentScale > 0.1) {
    const scaledWidth = Math.max(1, Math.round(image.width * currentScale))
    const scaledHeight = Math.max(1, Math.round(image.height * currentScale))

    tempCanvas.width = scaledWidth
    tempCanvas.height = scaledHeight
    tempCtx.drawImage(image, 0, 0, scaledWidth, scaledHeight)

    const testBlob = await getCanvasBlob(tempCanvas, 1.0)
    if (testBlob.size <= targetSizeBytes) {
      finalBlob = testBlob
      finalQuality = 1.0
      finalWidth = scaledWidth
      finalHeight = scaledHeight
      break
    }

    let minQuality = 0
    let maxQuality = 1
    let bestQuality = 0
    let bestBlob: Blob | null = null

    for (let i = 0; i < 7; i++) {
      const quality = (minQuality + maxQuality) / 2
      const blob = await getCanvasBlob(tempCanvas, quality)

      if (blob.size <= targetSizeBytes) {
        bestQuality = quality
        bestBlob = blob
        minQuality = quality
      } else {
        maxQuality = quality
      }
    }

    if (bestBlob) {
      finalBlob = bestBlob
      finalQuality = bestQuality
      finalWidth = scaledWidth
      finalHeight = scaledHeight
      break
    }

    currentScale -= 0.1
  }

  if (!finalBlob) return null

  return {
    blob: finalBlob,
    quality: finalQuality,
    width: finalWidth,
    height: finalHeight,
  }
}