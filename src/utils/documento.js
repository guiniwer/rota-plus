// Validação de CPF e CNPJ pelos dígitos verificadores (Receita Federal).
const so = (s = '') => String(s).replace(/\D/g, '')

export function cpfValido(valor) {
  const d = so(valor)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const dv = (n) => {
    const soma = [...d.slice(0, n)].reduce((s, c, i) => s + Number(c) * (n + 1 - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

export function cnpjValido(valor) {
  const d = so(valor)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const dv = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const r = [...d.slice(0, n)].reduce((s, c, i) => s + Number(c) * pesos[i], 0) % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13])
}

export const documentoValido = (valor) => (so(valor).length === 11 ? cpfValido(valor) : cnpjValido(valor))
