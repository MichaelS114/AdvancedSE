import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import deDE from 'antd/locale/de_DE';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/DashboardLayout';
import PropertyView from './pages/PropertyView';
import Profile from './pages/Profile';
import DashboardHome from './pages/DashboardHome';
import MunicipalTaxes from './pages/MunicipalTaxes';
import ContractorDirectory from './pages/ContractorDirectory';
import ProjectManagement from './pages/ProjectManagement';
import ProjectTendering from './pages/ProjectTendering';
import OfferManagement from './pages/OfferManagement';
import InsuranceClaims from './pages/InsuranceClaims';
import Documents from './pages/Documents';

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
      <AntApp>
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
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardHome />} />
                <Route path="property" element={<PropertyView />} />
                <Route path="projects" element={<ProjectManagement />} />
                <Route path="offers" element={<OfferManagement />} />
                <Route path="taxes" element={<MunicipalTaxes />} />
                <Route path="maintenance" element={<ProjectTendering />} />
                <Route path="contractors" element={<ContractorDirectory />} />
                <Route path="insurance" element={<InsuranceClaims />} />
                <Route path="documents" element={<Documents />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
