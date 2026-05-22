import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, Layout, Typography, Button, Card } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';

const { Title, Text } = Typography;

const Dashboard = () => {
  const { user, logout } = useAuth();
  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827' }}>
      <Card style={{ width: 400, textAlign: 'center', borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <Title level={2}>Welcome {user?.firstName}!</Title>
        <Text style={{ display: 'block', marginBottom: 24, fontSize: 16 }}>
          Role: <strong style={{ color: '#1677ff' }}>{user?.role}</strong>
        </Text>
        <Button type="primary" danger block size="large" onClick={logout}>
          Logout
        </Button>
      </Card>
    </Layout>
  );
};

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
      theme={{ 
        algorithm: theme.darkAlgorithm, 
        token: { 
          colorPrimary: '#1677ff',
          borderRadius: 8
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
                <Dashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
