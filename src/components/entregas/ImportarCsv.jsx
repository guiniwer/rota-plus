import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { EntregasApi } from '../../services/api'
import { MODELO_CSV, csvParaEntregas } from '../../utils/csv'
import Button from '../ui/Button'
import DataTable from '../ui/DataTable'
import Icon from '../ui/Icon'

/** Importação de entregas a partir de planilha CSV (Excel / Google Planilhas). */
export default function ImportarCsv() {
  const { executar, toast } = useApp()
  const [arquivo, setArquivo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const ler = async (file) => {
    if (!file) return
    setArquivo(file.name)
    setResultado(null)
    setPrevia(csvParaEntregas(await file.text()))
  }
  const importar = async () => {
    setEnviando(true)
    const r = await executar(() => EntregasApi.importar(previa.entregas))
    setEnviando(false)
    if (!r) return
    setResultado(r)
    toast(`${r.criadas} entrega(s) importada(s).`)
  }
  const baixarModelo = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + MODELO_CSV], { type: 'text/csv;charset=utf-8' }))
    Object.assign(document.createElement('a'), { href: url, download: 'modelo-entregas.csv' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <p className="small muted">
        Exporte do Excel ou Google Planilhas como CSV. Colunas reconhecidas: cliente, endereço, cidade, janela (ex.: 09:00–11:00), prazo, telefone, e-mail, carga, peso, valor, valor NF, documento, entregador (e-mail) e instruções. Até 500 linhas por arquivo; os endereços são localizados no mapa em seguida.
      </p>
      <div className="row wrap">
        <label className="btn btn-primary">
          <Icon name="upload" size={18} /> Escolher arquivo
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => ler(e.target.files[0])} />
        </label>
        <Button variant="secondary" icon="download" onClick={baixarModelo}>
          Baixar modelo
        </Button>
        {arquivo && <span className="small muted">{arquivo}</span>}
      </div>
      {previa && (
        <>
          <p className="small">
            {previa.entregas.length} linha(s) · colunas reconhecidas: {previa.colunas.join(', ') || 'nenhuma'}
          </p>
          <DataTable
            rows={previa.entregas.slice(0, 5).map((e, i) => ({ ...e, id: i }))}
            columns={[
              { key: 'cliente', label: 'Cliente' },
              { key: 'destino', label: 'Endereço' },
              { key: 'janela', label: 'Janela' },
              { key: 'entregadorEmail', label: 'Entregador' },
            ]}
          />
          <Button onClick={importar} disabled={enviando || !previa.entregas.length} style={{ alignSelf: 'flex-start' }}>
            {enviando ? 'Importando…' : `Importar ${previa.entregas.length} entrega(s)`}
          </Button>
        </>
      )}
      {resultado && (
        <div className="stack-sm">
          <strong className="green">{resultado.criadas} criada(s)</strong>
          {resultado.erros.map((e) => (
            <span key={e.linha} className="small red">
              Linha {e.linha}: {e.erro}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
