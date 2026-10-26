import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './app/AppRoutes.jsx'

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
