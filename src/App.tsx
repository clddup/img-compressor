import { useEffect, useRef, useState } from 'react'
import { BackgroundEffects } from './components/BackgroundEffects'
import { compressImage } from './lib/compress'
import { buildZip, downloadBlob, getFileName, isImagePath, readImagesFromZip, stripExtension } from './lib/files'
import type { CompressedImage, ImageItem } from './lib/types'

function App() {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [targetSizeKB, setTargetSizeKB] = useState(50)
  const [selectedImages, setSelectedImages] = useState<ImageItem[]>([])
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [busyText, setIsBusyText] = useState('压缩并导出')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const firstImage = selectedImages[0]
    const canvas = previewCanvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!firstImage || !canvas || !ctx) {
      if (canvas) canvas.style.display = 'none'
      return
    }

    const image = new Image()
    const url = URL.createObjectURL(firstImage.file)

    image.onload = () => {
      canvas.width = image.width
      canvas.height = image.height
      ctx.drawImage(image, 0, 0)

      const previewContainerWidth = canvas.parentElement?.clientWidth ?? image.width
      const maxPreviewHeight = 400
      const imageAspectRatio = image.width / image.height

      let previewWidth = image.width
      let previewHeight = image.height

      if (previewWidth > previewContainerWidth) {
        previewWidth = previewContainerWidth
        previewHeight = previewWidth / imageAspectRatio
      }

      if (previewHeight > maxPreviewHeight) {
        previewHeight = maxPreviewHeight
        previewWidth = previewHeight * imageAspectRatio
      }

      canvas.style.width = `${previewWidth}px`
      canvas.style.height = `${previewHeight}px`
      canvas.style.display = 'block'
      URL.revokeObjectURL(url)
    }

    image.onerror = () => {
      canvas.style.display = 'none'
      URL.revokeObjectURL(url)
    }

    image.src = url
  }, [selectedImages])

  const totalSelectedSize = selectedImages.reduce((sum: number, image: ImageItem) => sum + image.file.size, 0)

  type UploadCandidate = {
    file: File
    name: string
  }

  function setImages(images: ImageItem[], sourceLabel: string) {
    setSelectedImages(images)
    setProgress(0)
    setMessage('')
    setIsError(false)

    if (images.length === 0) {
      setMessage(`未从${sourceLabel}中找到可处理的图片。`)
      setIsError(true)
    }
  }

  function isZipFile(file: File) {
    return file.type === 'application/zip'
      || file.type === 'application/x-zip-compressed'
      || file.name.toLowerCase().endsWith('.zip')
  }

  async function handleUploadCandidates(candidates: UploadCandidate[], sourceLabel: string) {
    const imageItems: ImageItem[] = candidates
      .filter(candidate => candidate.file.type.startsWith('image/') || isImagePath(candidate.name))
      .map(candidate => ({
        file: candidate.file,
        name: candidate.name,
      }))

    const zipCandidates = candidates.filter(candidate => isZipFile(candidate.file))

    if (zipCandidates.length > 0) {
      setIsBusy(true)
      setIsBusyText('读取 ZIP...')
    }

    try {
      for (const candidate of zipCandidates) {
        const zipImages = await readImagesFromZip(candidate.file)
        const zipBaseName = stripExtension(getFileName(candidate.name)) || 'zip'

        imageItems.push(...zipImages.map(image => ({
          file: image.file,
          name: `${zipBaseName}/${image.name}`,
        })))
      }

      setImages(imageItems, sourceLabel)
    } catch (error) {
      setMessage(`文件读取失败: ${error instanceof Error ? error.message : '文件格式不正确'}`)
      setIsError(true)
    } finally {
      setIsBusy(false)
      setIsBusyText('压缩并导出')
    }
  }

  async function handleExport(images: ImageItem[] = selectedImages) {
    if (!Number.isFinite(targetSizeKB) || targetSizeKB <= 0) {
      setMessage('请输入大于 0 的目标大小。')
      setIsError(true)
      return
    }

    if (images.length === 0) {
      setMessage('请先选择图片、ZIP 或文件夹。')
      setIsError(true)
      return
    }

    setIsBusy(true)
    setIsBusyText('压缩中...')
    setMessage('')
    setIsError(false)
    setProgress(0)

    const targetSizeBytes = targetSizeKB * 1024
    const sourceTotalSize = images.reduce((sum: number, image: ImageItem) => sum + image.file.size, 0)
    const results: CompressedImage[] = []
    const failures: string[] = []

    try {
      for (let i = 0; i < images.length; i++) {
        const item = images[i]
        setIsBusyText(`压缩中 ${i + 1}/${images.length}`)

        try {
          const compressed = await compressImage(item.file, targetSizeBytes)
          if (!compressed) {
            failures.push(item.name)
          } else {
            results.push({ ...compressed, source: item })
          }
        } catch (error) {
          failures.push(`${item.name} (${error instanceof Error ? error.message : '处理失败'})`)
        }

        setProgress(Math.round(((i + 1) / images.length) * 100))
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      if (results.length === 0) {
        setMessage('压缩失败：没有图片能在合理范围内压缩到目标大小。')
        setIsError(true)
        return
      }

      if (results.length === 1) {
        const result = results[0]
        const filename = `${stripExtension(getFileName(result.source.name)) || 'image'}-compressed-${targetSizeKB}kb.jpg`
        downloadBlob(result.blob, filename)
      } else {
        const zipBlob = await buildZip(results, targetSizeKB)
        downloadBlob(zipBlob, `compressed-images-${targetSizeKB}kb.zip`)
      }

      const compressedTotal = results.reduce((sum, result) => sum + result.blob.size, 0)
      const firstResult = results[0]
      const failureText = failures.length > 0
        ? `\n失败: ${failures.length} 张\n${failures.slice(0, 5).join('\n')}${failures.length > 5 ? '\n...' : ''}`
        : ''

      setMessage([
        '压缩完成!',
        `成功: ${results.length} / ${images.length} 张`,
        `原始总大小: ${(sourceTotalSize / 1024 / 1024).toFixed(2)} MB`,
        `压缩后总大小: ${(compressedTotal / 1024 / 1024).toFixed(2)} MB`,
        `首张质量: ${(firstResult.quality * 100).toFixed(0)}%`,
        `首张尺寸: ${firstResult.width} x ${firstResult.height}px`,
      ].join('\n') + failureText)
    } finally {
      setIsBusy(false)
      setIsBusyText('压缩并导出')
    }
  }

  return (
    <>
      <BackgroundEffects />
      <main className="container">
        <h1>智能图片压缩</h1>
        <p>上传图片、ZIP 压缩包或文件夹，设定单张目标大小后批量导出。</p>

        <div className="controls">
          <label htmlFor="target-size-input">单张目标大小:</label>
          <input
            id="target-size-input"
            min="1"
            step="1"
            type="number"
            value={targetSizeKB}
            onChange={event => setTargetSizeKB(Number(event.target.value))}
          />
          <span>KB</span>
        </div>

        <div className="upload-actions">
          <button
            className="button upload-button"
            disabled={isBusy}
            type="button"
            onClick={() => uploadInputRef.current?.click()}
          >
            选择图片 / ZIP
          </button>
          <button
            className="button upload-button"
            disabled={isBusy}
            type="button"
            onClick={() => folderInputRef.current?.click()}
          >
            选择文件夹
          </button>

          <input
            ref={uploadInputRef}
            accept="image/*,.zip,application/zip,application/x-zip-compressed"
            multiple
            type="file"
            onChange={(event) => {
              const candidates = Array.from(event.target.files ?? []).map(file => ({
                file,
                name: file.name,
              }))

              void handleUploadCandidates(candidates, '选择内容')
              event.target.value = ''
            }}
          />
          <input
            ref={folderInputRef}
            multiple
            type="file"
            {...{ webkitdirectory: '' }}
            onChange={(event) => {
              const candidates = Array.from(event.target.files ?? []).map(file => ({
                file,
                name: file.webkitRelativePath || file.name,
              }))

              void handleUploadCandidates(candidates, '文件夹')
              event.target.value = ''
            }}
          />
        </div>

        <button className="button export-button" disabled={isBusy || selectedImages.length === 0} type="button" onClick={() => void handleExport()}>
          {isBusy ? busyText : '压缩并导出'}
        </button>

        {selectedImages.length > 0 && (
          <div id="selected-files-info">
            已选择 {selectedImages.length} 张图片，原始总大小 {(totalSelectedSize / 1024 / 1024).toFixed(2)} MB。
          </div>
        )}

        {isBusy && (
          <div className="progress-wrap">
            <div id="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}

        {message && (
          <div id="result-info" className={isError ? 'is-error' : ''}>
            {message.split('\n').map((line: string, index: number) => (
              <span key={`${line}-${index}`}>
                {line}
                <br />
              </span>
            ))}
          </div>
        )}

        <canvas id="preview-canvas" ref={previewCanvasRef} />
      </main>
    </>
  )
}

export default App