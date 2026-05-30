import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Layout, Card, Typography, Form, Input, Button, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      setError('');
      const response = await axios.post('http://localhost:5001/api/auth/login', {
        email: values.email,
        password: values.password
      });
      
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ein Fehler ist beim Anmelden aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: '100%', maxWidth: 420, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '10px 0' }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/logo.png"
            alt="HouseVibe Logo"
            style={{ width: 140, height: 112, objectFit: 'contain', marginBottom: 12 }}
          />
          <Title level={3} style={{ margin: '0 0 8px' }}>house.vibe</Title>
          <Title level={2} style={{ margin: 0 }}>Willkommen zurück</Title>
          <Text type="secondary">Melden Sie sich an, um Ihren Haushalt zu verwalten.</Text>
        </div>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />
        )}

        <Form name="login_form" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item
            name="email"
            rules={[{ required: true, message: 'Bitte geben Sie Ihre E-Mail-Adresse ein!' }, { type: 'email', message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="E-Mail-Adresse" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Bitte geben Sie Ihr Passwort ein!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Passwort" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Anmelden
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">
            Noch kein Konto? <Link to="/register" style={{ color: '#1677ff' }}>Hier registrieren</Link>
          </Text>
        </div>
      </Card>
    </Layout>
  );
};

export default Login;
