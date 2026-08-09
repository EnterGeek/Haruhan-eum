import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorDimensionsLab } from './ColorDimensionsLab'
import './styles.css'

const root = document.getElementById('work02-color-dimensions-root')
if (root === null) throw new Error('Missing Work 02 Color Dimensions Lab root element.')
createRoot(root).render(<StrictMode><ColorDimensionsLab /></StrictMode>)
