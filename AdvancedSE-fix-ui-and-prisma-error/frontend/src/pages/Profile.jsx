import { useState } from 'react';
import { Card, Form, Input, Button, Typography, App } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const Profile = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { token, user } = useAuth();
  const { message } = App.useApp();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await axios.put('http://localhost:5001/api/auth/password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Passwort erfolgreich geändert!');
      form.resetFields();
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Ändern des Passworts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={2}>Profil</Title>
      <Text style={{ display: 'block', marginBottom: 24 }}>Hallo {user?.firstName}, hier kannst du dein Passwort ändern.</Text>
      
      <Card title="Passwort ändern" bordered={false} style={{ maxWidth: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="oldPassword"
            label="Altes Passwort"
            rules={[{ required: true, message: 'Bitte altes Passwort eingeben' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Neues Passwort"
            rules={[{ required: true, message: 'Bitte neues Passwort eingeben' }, { min: 6, message: 'Passwort muss mindestens 6 Zeichen lang sein' }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Neues Passwort bestätigen"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Bitte Passwort bestätigen' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Die Passwörter stimmen nicht überein!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Passwort aktualisieren
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Profile;
