import Field from '../ui/Field'
import Icon from '../ui/Icon'
import { OPCOES_CIDADES, nomeCidade } from '../../data/cidades'
import { distanciaKm } from '../../utils/frete'

/** Escolha de cidade de origem e destino, com botão para inverter e a distância estimada. */
export default function RotaCidades({ origem, destino, onChange }) {
  const inverter = () => onChange({ origem: destino, destino: origem })
  const km = distanciaKm(origem, destino)

  return (
    <div className="stack-sm">
      <div className="rota-cidades">
        <Field label="Cidade de origem" as="select" value={origem} onChange={(e) => onChange({ origem: e.target.value, destino })} options={OPCOES_CIDADES} />
        <button type="button" className="icon-button rota-swap" onClick={inverter} aria-label="Inverter origem e destino" title="Inverter origem e destino">
          <Icon name="swap" size={18} />
        </button>
        <Field label="Cidade de destino" as="select" value={destino} onChange={(e) => onChange({ origem, destino: e.target.value })} options={OPCOES_CIDADES} />
      </div>
      <p className="rota-resumo">
        <Icon name="route" size={16} color="var(--pink)" />
        <span>
          {nomeCidade(origem)} → {nomeCidade(destino)}
        </span>
        <strong>
          {origem === destino ? 'entrega urbana' : `≈ ${km.toLocaleString('pt-BR')} km por estrada`}
        </strong>
      </p>
    </div>
  )
}
