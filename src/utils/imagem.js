/** Reduz a foto da câmera (normalmente 3–12 MB) para JPEG de até 1280 px, pronta para enviar (~150–400 KB). */
export async function comprimirFoto(arquivo, { max = 1280, qualidade = 0.72 } = {}) {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }).catch(() => null)
  const fonte = bitmap ?? (await carregarImagem(arquivo))
  const escala = Math.min(1, max / Math.max(fonte.width, fonte.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(fonte.width * escala), height: Math.round(fonte.height * escala) })
  canvas.getContext('2d').drawImage(fonte, 0, 0, canvas.width, canvas.height)
  bitmap?.close()
  return canvas.toDataURL('image/jpeg', qualidade)
}

function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => (URL.revokeObjectURL(url), resolve(img))
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error('Não foi possível ler a foto.')))
    img.src = url
  })
}
