import { useEffect } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { CheckoutPage } from '../pages/CheckoutPage.jsx'
import { NotFoundPage } from '../pages/NotFoundPage.jsx'
import { PaymentResultPage } from '../pages/PaymentResultPage.jsx'
import { PaymentStepPage } from '../pages/PaymentStepPage.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/checkout" replace />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/:attemptId" element={<PaymentStepPage />} />
        <Route
          path="/payment/:attemptId/result"
          element={<PaymentResultPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
