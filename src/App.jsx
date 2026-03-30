import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FormPage from './pages/FormPage';
import BoardPage from './pages/BoardPage';
import MyDemandsPage from './pages/MyDemandsPage';
import AdminPage from './pages/AdminPage';
import ToolsPage from './pages/ToolsPage';
import DashboardsPage from './pages/DashboardsPage';
import ScrumPage from './pages/ScrumPage';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      {user && <Header />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/nova-demanda" element={
          <ProtectedRoute><FormPage /></ProtectedRoute>
        } />
        <Route path="/minhas-demandas" element={
          <ProtectedRoute><MyDemandsPage /></ProtectedRoute>
        } />
        <Route path="/board" element={
          <ProtectedRoute roles={['admin', 'supervisor']}><BoardPage /></ProtectedRoute>
        } />
        <Route path="/scrum" element={
          <ProtectedRoute roles={['admin', 'supervisor']}><ScrumPage /></ProtectedRoute>
        } />
        <Route path="/ferramentas" element={
          <ProtectedRoute roles={['admin', 'supervisor']}><ToolsPage /></ProtectedRoute>
        } />
        <Route path="/infraestrutura" element={
          <ProtectedRoute roles={['admin', 'supervisor']}><DashboardsPage /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            {user?.role === 'user' ? <Navigate to="/nova-demanda" replace /> : <Navigate to="/board" replace />}
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
