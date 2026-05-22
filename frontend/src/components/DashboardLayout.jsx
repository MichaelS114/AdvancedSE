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
  KeyOutlined
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
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
          <div style={{ padding: '16px', textAlign: 'center', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            {isHausbesitzer ? (
              <Avatar size={collapsed ? 32 : 64} icon={<HomeOutlined />} style={{ backgroundColor: token.colorPrimary }} />
            ) : (
              <Avatar size={collapsed ? 32 : 64} icon={<ToolOutlined />} style={{ backgroundColor: '#fa8c16' }} />
            )}
            {!collapsed && (
              <div style={{ marginTop: 12 }}>
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
