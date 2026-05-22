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
      setError(err.response?.data?.error || 'Ein Fehler ist bei der Registrierung aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', padding: '20px' }}>
      <Card style={{ width: '100%', maxWidth: 480, borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>Konto erstellen</Title>
          <Text type="secondary">Treten Sie unserer Haushaltsverwaltungs-Plattform bei.</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} />}
        {success && <Alert message="Registrierung erfolgreich! Weiterleitung zum Login..." type="success" showIcon style={{ marginBottom: 24 }} />}

        <Form 
          name="register_form" 
          onFinish={onFinish} 
          layout="vertical" 
          size="large"
          initialValues={{ role: 'HAUSBESITZER' }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="firstName" rules={[{ required: true, message: 'Vorname ist erforderlich' }]}>
                <Input placeholder="Vorname" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" rules={[{ required: true, message: 'Nachname ist erforderlich' }]}>
                <Input placeholder="Nachname" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="username" rules={[{ required: true, message: 'Benutzername ist erforderlich' }]}>
            <Input prefix={<IdcardOutlined />} placeholder="Benutzername" />
          </Form.Item>

          <Form.Item name="email" rules={[{ required: true, message: 'E-Mail ist erforderlich' }, { type: 'email', message: 'Ungültige E-Mail-Adresse' }]}>
            <Input prefix={<MailOutlined />} placeholder="E-Mail-Adresse" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Passwort ist erforderlich' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Passwort" />
          </Form.Item>

          <Form.Item name="role" label="Rolle auswählen" rules={[{ required: true }]}>
            <Radio.Group style={{ width: '100%' }} optionType="button" buttonStyle="solid">
              <Row gutter={12}>
                <Col span={12}>
                  <Radio.Button value="HAUSBESITZER" style={{ width: '100%', textAlign: 'center', borderRadius: '8px 0 0 8px' }}>
                    Hausbesitzer
                  </Radio.Button>
                </Col>
                <Col span={12}>
                  <Radio.Button value="PROFESSIONIST" style={{ width: '100%', textAlign: 'center', borderRadius: '0 8px 8px 0' }}>
                    Professionist
                  </Radio.Button>
                </Col>
              </Row>
            </Radio.Group>
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading} disabled={success}>
              Registrieren
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Bereits ein Konto? <Link to="/login" style={{ color: '#1677ff' }}>Hier anmelden</Link>
          </Text>
        </div>
      </Card>
    </Layout>
  );
};

export default Register;
