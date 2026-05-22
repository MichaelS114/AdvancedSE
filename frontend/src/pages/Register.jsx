import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Layout, Card, Typography, Form, Input, Button, Alert, Radio, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Register = () => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      setError('');
      await axios.post('http://localhost:5001/api/auth/register', values);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827', padding: '20px' }}>
      <Card style={{ width: '100%', maxWidth: 450, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>Create Account</Title>
          <Text type="secondary">Join our household management platform.</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
        {success && <Alert message="Registration successful! Redirecting to login..." type="success" showIcon style={{ marginBottom: 24 }} />}

        <Form 
          name="register_form" 
          onFinish={onFinish} 
          layout="vertical" 
          size="large"
          initialValues={{ role: 'HAUSBESITZER' }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="firstName" rules={[{ required: true, message: 'First name is required' }]}>
                <Input placeholder="First Name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" rules={[{ required: true, message: 'Last name is required' }]}>
                <Input placeholder="Last Name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="username" rules={[{ required: true, message: 'Username is required' }]}>
            <Input prefix={<IdcardOutlined />} placeholder="Username" />
          </Form.Item>

          <Form.Item name="email" rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Invalid email' }]}>
            <Input prefix={<MailOutlined />} placeholder="Email address" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>

          <Form.Item name="role" label="Select Role" rules={[{ required: true }]}>
            <Radio.Group style={{ width: '100%' }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Radio.Button value="HAUSBESITZER" style={{ width: '100%', textAlign: 'center' }}>
                    Hausbesitzer
                  </Radio.Button>
                </Col>
                <Col span={12}>
                  <Radio.Button value="PROFESSIONIST" style={{ width: '100%', textAlign: 'center' }}>
                    Professionist
                  </Radio.Button>
                </Col>
              </Row>
            </Radio.Group>
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading} disabled={success}>
              Register
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Already have an account? <Link to="/login" style={{ color: '#1677ff' }}>Login here</Link>
          </Text>
        </div>
      </Card>
    </Layout>
  );
};

export default Register;
