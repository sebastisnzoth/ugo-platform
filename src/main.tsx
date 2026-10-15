import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ClientExperience from './ClientExperience'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const isClientExperience = params.get('app') === 'client'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isClientExperience ? <ClientExperience /> : <App />}</React.StrictMode>
)
