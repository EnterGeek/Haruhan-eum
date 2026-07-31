import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Work02Lab } from './Work02Lab'
import './styles.css'

const root = document.getElementById('work02-lab-root')
if (root === null) throw new Error('Missing Work 02 Lab root element.')

createRoot(root).render(<StrictMode><Work02Lab /></StrictMode>)
