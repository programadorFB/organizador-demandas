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
import DesignSelectPage from './pages/DesignSelectPage';
import DesignBoardPage from './pages/DesignBoardPage';
import DesignAnalyticsPage from './pages/DesignAnalyticsPage';

function AppRoutes() {
  const { user } = useAuth();
  const isDesignUser = user && ['designer', 'design_admin'].includes(user.role);

  return (
    <>
      {user && !isDesignUser && <Header />}
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
        {/* Design Board */}
        <Route path="/design" element={<DesignSelectPage />} />
        <Route path="/design/board" element={
          <ProtectedRoute roles={['admin', 'design_admin', 'designer']}><DesignBoardPage /></ProtectedRoute>
        } />
        <Route path="/design/analytics" element={
          <ProtectedRoute roles={['admin', 'design_admin']}><DesignAnalyticsPage /></ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            {user?.role === 'designer' || user?.role === 'design_admin'
              ? <Navigate to="/design/board" replace />
              : user?.role === 'user'
              ? <Navigate to="/nova-demanda" replace />
              : <Navigate to="/board" replace />}
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
