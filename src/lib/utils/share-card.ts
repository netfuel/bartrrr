/**
 * Renders a social share card (1200x630) for a listing on a canvas.
 * Returns null if rendering fails (e.g. canvas unsupported) — callers
 * fall back to sharing the plain link.
 */
export interface ShareCardData {
  title: string
  seeking: string
  neighborhood?: string
  imageUrl?: string
}

const W = 1200
const H = 630

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) {
        lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, '…')
        return lines
      }
    } else {
      line = attempt
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

export async function renderShareCard(data: ShareCardData): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Cream background
    ctx.fillStyle = '#F8F3EC'
    ctx.fillRect(0, 0, W, H)

    // Photo fills the right half when available
    const textWidth = 620
    const img = data.imageUrl ? await loadImage(data.imageUrl) : null
    if (img) {
      const dw = W - textWidth
      const scale = Math.max(dw / img.width, H / img.height)
      const sw = dw / scale
      const sh = H / scale
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, textWidth, 0, dw, H)
    }

    // Clay accent bar
    ctx.fillStyle = '#C05A35'
    ctx.fillRect(0, 0, 16, H)

    const x = 64

    // Wordmark
    ctx.fillStyle = '#C05A35'
    ctx.font = 'bold 44px Georgia, serif'
    ctx.fillText('Bartrrr', x, 96)
    ctx.fillStyle = '#8A8278'
    ctx.font = '26px system-ui, sans-serif'
    ctx.fillText("Trade, don't buy.", x + 170, 96)

    // Listing title
    ctx.fillStyle = '#1A1714'
    ctx.font = 'bold 58px Georgia, serif'
    let y = 210
    for (const line of wrapText(ctx, data.title, textWidth - x - 32, 3)) {
      ctx.fillText(line, x, y)
      y += 70
    }

    // Seeking
    ctx.fillStyle = '#2A5240'
    ctx.font = 'bold 24px system-ui, sans-serif'
    ctx.fillText('LOOKING TO TRADE FOR', x, y + 28)
    ctx.fillStyle = '#3D3830'
    ctx.font = '32px system-ui, sans-serif'
    y += 76
    for (const line of wrapText(ctx, data.seeking, textWidth - x - 32, 2)) {
      ctx.fillText(line, x, y)
      y += 44
    }

    // Neighborhood footer
    if (data.neighborhood) {
      ctx.fillStyle = '#8A8278'
      ctx.font = '26px system-ui, sans-serif'
      ctx.fillText(`📍 ${data.neighborhood}`, x, H - 56)
    }

    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  }
}
