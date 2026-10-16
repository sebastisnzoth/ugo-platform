import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import UgoClient from './exact/UgoClient'
import './styles.css'
import './exact/ugo-original.css'
import './exact/ugo-real.css'

const params = new URLSearchParams(window.location.search)
const isClientExperience = params.get('app') === 'client'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isClientExperience ? <UgoClient /> : <App />}</React.StrictMode>
)
