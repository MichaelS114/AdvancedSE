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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null}
        collapsible 
        collapsed={collapsed} 
        theme="light"
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <div style={{ padding: '16px', textAlign: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ 
                width: collapsed ? 32 : 80, 
                height: collapsed ? 32 : 80, 
                objectFit: 'contain',
                marginBottom: collapsed ? 0 : 8 
              }} 
            />
            {!collapsed && (
              <div>
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
      <Layout>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: token.colorBgContainer, borderRadius: token.borderRadius }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
