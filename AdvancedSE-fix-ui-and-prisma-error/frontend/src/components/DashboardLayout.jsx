import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Typography, Space, theme } from 'antd';
import { 
  HomeOutlined, 
  ToolOutlined, 
  FileTextOutlined, 
  SettingOutlined, 
  FolderOpenOutlined, 
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const isHausbesitzer = user?.role === 'HAUSBESITZER';

  const menuItems = [
    {
      key: '/property',
      icon: <HomeOutlined />,
      label: 'Objekt'
    },
    {
      key: '/taxes',
      icon: <FileTextOutlined />,
      label: 'Steuerakt'
    },
    {
      key: '/maintenance',
      icon: <SettingOutlined />,
      label: 'Instandhaltung'
    },
    {
      key: '/documents',
      icon: <FolderOpenOutlined />,
      label: 'Dokumente'
    }
  ];

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <KeyOutlined />,
        label: 'Profil / Passwort',
        onClick: () => navigate('/profile')
      },
      {
        type: 'divider'
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Abmelden',
        danger: true,
        onClick: logout
      }
    ]
  };

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider 
        trigger={null}
        collapsible 
        collapsed={collapsed} 
        theme="light"
        style={{
          height: '100vh',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <div style={{ padding: '16px', textAlign: 'left', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <img 
              src="/logo.png" 
              alt="HouseVibe Logo" 
              style={{ 
                width: collapsed ? 40 : 128, 
                height: collapsed ? 40 : 96, 
                objectFit: 'contain',
                display: 'block',
                marginBottom: collapsed ? 0 : 10 
              }} 
            />
            {!collapsed && (
              <div>
                <Text strong style={{ display: 'block', fontSize: 18, lineHeight: 1.1, marginBottom: 4 }}>house.vibe</Text>
                <Text strong style={{ display: 'block' }}>{isHausbesitzer ? 'Hausbesitzer' : 'Professionist'}</Text>
              </div>
            )}
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Menu 
              theme="light" 
              mode="inline" 
              selectedKeys={[location.pathname]} 
              items={menuItems} 
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0 }}
            />
          </div>

          <div style={{ padding: '16px', borderTop: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 16, color: token.colorTextSecondary }}
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Ausklappen" : "Einklappen"}
            >
              {collapsed ? <MenuUnfoldOutlined style={{ fontSize: '18px' }} /> : <MenuFoldOutlined style={{ fontSize: '18px' }} />}
            </div>
            
            <Dropdown menu={userMenu} trigger={['click']} placement="topLeft">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }}>
                <Avatar icon={<UserOutlined />} />
                {!collapsed && (
                  <Text strong style={{ marginLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.firstName}
                  </Text>
                )}
              </div>
            </Dropdown>
          </div>
        </div>
      </Sider>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 0,
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            overflowY: 'auto'
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
