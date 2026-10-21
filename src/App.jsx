import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import PublicLayout from './components/layout/PublicLayout'
import Toast from './components/layout/Toast'
import { AppProvider } from './context/AppContext'

import Cadastro from './pages/publico/Cadastro'
import Landing from './pages/publico/Landing'
import Login from './pages/publico/Login'
import RastreioPublico from './pages/publico/RastreioPublico'

import Acompanhar from './pages/cliente/Acompanhar'
import AvaliarEntrega from './pages/cliente/AvaliarEntrega'
import ClienteInicio from './pages/cliente/ClienteInicio'
import Historico from './pages/cliente/Historico'
import Notificacoes from './pages/cliente/Notificacoes'
import NovoPedido from './pages/cliente/NovoPedido'
import Previsao from './pages/cliente/Previsao'
import StatusEncomenda from './pages/cliente/StatusEncomenda'

import Perfil from './pages/comum/Perfil'
import MinhasEntregas from './pages/entregador/MinhasEntregas'

import Alertas from './pages/empresa/Alertas'
import AtivoDetalhe from './pages/empresa/AtivoDetalhe'
import Ativos from './pages/empresa/Ativos'
import Configuracoes from './pages/empresa/Configuracoes'
import Entregas from './pages/empresa/Entregas'
import Equipes from './pages/empresa/Equipes'
import Escanear from './pages/empresa/Escanear'
import MapaAoVivo from './pages/empresa/MapaAoVivo'
import Painel from './pages/empresa/Painel'
import Relatorios from './pages/empresa/Relatorios'

export default function App() {
  return (
    <AppProvider>
      {/* HashRouter: funciona em qualquer hospedagem estática (ex.: GitHub Pages) */}
      <HashRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/rastreio" element={<RastreioPublico />} />
          </Route>

          <Route path="/cliente" element={<AppLayout perfil="cliente" />}>
            <Route index element={<ClienteInicio />} />
            <Route path="novo-pedido" element={<NovoPedido />} />
            <Route path="acompanhar/:id?" element={<Acompanhar />} />
            <Route path="status/:id?" element={<StatusEncomenda />} />
            <Route path="previsao/:id?" element={<Previsao />} />
            <Route path="historico" element={<Historico />} />
            <Route path="notificacoes" element={<Notificacoes />} />
            <Route path="avaliar/:id?" element={<AvaliarEntrega />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>

          <Route path="/empresa" element={<AppLayout perfil="empresa" />}>
            <Route index element={<Painel />} />
            <Route path="entregas" element={<Entregas />} />
            <Route path="ativos" element={<Ativos />} />
            <Route path="ativos/:id" element={<AtivoDetalhe />} />
            <Route path="mapa" element={<MapaAoVivo />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="equipes" element={<Equipes />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="escanear" element={<Escanear />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>

          {/* entregador: acesso apenas à própria tela de entregas */}
          <Route path="/entregador" element={<AppLayout perfil="entregador" />}>
            <Route index element={<MinhasEntregas />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toast />
      </HashRouter>
    </AppProvider>
  )
}
