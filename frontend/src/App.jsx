import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import deDE from 'antd/locale/de_DE';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/DashboardLayout';
import PropertyView from './pages/PropertyView';
import Profile from './pages/Profile';
import DashboardHome from './pages/DashboardHome';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <ConfigProvider 
      locale={deDE}
      theme={{ 
        token: { 
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f0f2f5'
        } 
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/property" replace />} />
              <Route path="property" element={<PropertyView />} />
              <Route path="taxes" element={<DashboardHome title="Steuerakt" />} />
              <Route path="maintenance" element={<DashboardHome title="Instandhaltung" />} />
              <Route path="documents" element={<DashboardHome title="Dokumente" />} />
              <Route path="profile" element={<Profile />} />
            </Route>

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
