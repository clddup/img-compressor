export interface ImageItem {
  file: File
  name: string
}

export interface CompressionResult {
  blob: Blob
  quality: number
  width: number
  height: number
}

export interface CompressedImage extends CompressionResult {
  source: ImageItem
}

export interface BatchSummary {
  results: CompressedImage[]
  failures: string[]
}