import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErroGeral from './components/layout/ErroGeral'
import './styles/global.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/pages.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErroGeral>
      <App />
    </ErroGeral>
  </StrictMode>,
)
