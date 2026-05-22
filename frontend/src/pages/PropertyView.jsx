import React, { useState, useEffect, useMemo } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Divider, Row, Col, App, Table, Modal, Progress, Typography, Space } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import RoomTreemap from '../components/RoomTreemap';

const { Title, Text } = Typography;
const { Option } = Select;

const PropertyView = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [roomForm] = Form.useForm();
  const [propertyId, setPropertyId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);

  const fetchProperty = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/properties', {
        headers: { Authorization: `Bearer ${token}` }
      });
      form.setFieldsValue(res.data);
      setPropertyId(res.data.id);
      setRooms(res.data.rooms || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        message.error('Fehler beim Laden der Objektdaten');
      }
    }
  };

  useEffect(() => {
    fetchProperty();
  }, [token]);

  const onSaveProperty = async (values) => {
    setLoading(true);
    try {
      const res = await axios.put('http://localhost:5001/api/properties', values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Objektdaten gespeichert');
      setPropertyId(res.data.id);
      if (res.data.rooms) {
        setRooms(res.data.rooms);
      }
    } catch (err) {
      message.error('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRoomModal = (room = null) => {
    if (!propertyId) {
      message.warning('Bitte speichern Sie zuerst die Gebäude-Basisdaten.');
      return;
    }
    if (room) {
      setEditingRoomId(room.id);
      roomForm.setFieldsValue(room);
    } else {
      setEditingRoomId(null);
      roomForm.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSaveRoom = async (values) => {
    try {
      if (editingRoomId) {
        await axios.put(`http://localhost:5001/api/rooms/${editingRoomId}`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('Raum aktualisiert');
      } else {
        await axios.post(`http://localhost:5001/api/properties/${propertyId}/rooms`, values, {
          headers: { Authorization: `Bearer ${token}` }
        });
        message.success('Raum hinzugefügt');
      }
      setIsModalVisible(false);
      fetchProperty();
    } catch (err) {
      message.error('Fehler beim Speichern des Raums');
    }
  };

  const handleDeleteRoom = async (id) => {
    try {
      await axios.delete(`http://localhost:5001/api/rooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success('Raum gelöscht');
      fetchProperty();
    } catch (err) {
      message.error('Fehler beim Löschen des Raums');
    }
  };

  // Calculations for Room Book
  const totalLivingArea = Form.useWatch('livingArea', form) || 0;
  
  const totalRoomArea = useMemo(() => {
    return rooms.reduce((sum, room) => sum + (room.area || 0), 0);
  }, [rooms]);

  const areaPercentage = totalLivingArea > 0 ? Math.round((totalRoomArea / totalLivingArea) * 100) : 0;
  const isAreaExceeded = totalRoomArea > totalLivingArea;

  const roomColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Typ', dataIndex: 'type', key: 'type' },
    { title: 'Fläche (m²)', dataIndex: 'area', key: 'area' },
    { title: 'Boden', dataIndex: 'floorCovering', key: 'floorCovering' },
    {
      title: 'Aktionen',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenRoomModal(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRoom(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>Objekt verwalten</Title>
      
      <Row gutter={24}>
        <Col xs={24} lg={12}>
          {/* US 1.1: Gebäude-Basisdaten */}
          <Card title="Gebäude-Basisdaten" bordered={false} style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Form form={form} layout="vertical" onFinish={onSaveProperty}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="address" label="Adresse" rules={[{ required: true, message: 'Adresse ist erforderlich' }]}>
                    <Input placeholder="Musterstraße 1, 1234 Musterstadt" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="plotArea" label="Grundstücksfläche (m²)" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="livingArea" label="Wohnfläche (m²)" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="usableArea" label="Nutzfläche (m²)" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="constructionYear" label="Baujahr" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={1800} max={new Date().getFullYear()} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="plotNumber" label="EZ (Optional)">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="cadastralMunicipality" label="Katastralgemeinde (Optional)">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                Speichern
              </Button>
            </Form>
          </Card>

          {/* US 1.2: Raumbuch */}
          <Card title="Raumbuch" bordered={false} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} 
            extra={<Button type="dashed" icon={<PlusOutlined />} onClick={() => handleOpenRoomModal()}>Raum hinzufügen</Button>}
          >
            <div style={{ marginBottom: 24 }}>
              <Text strong>Raumflächen vs Wohnfläche:</Text>
              <Progress 
                percent={areaPercentage} 
                status={isAreaExceeded ? 'exception' : 'active'} 
                format={() => `${totalRoomArea} / ${totalLivingArea || 0} m²`}
                strokeColor={isAreaExceeded ? '#ff4d4f' : '#1677ff'}
              />
              {isAreaExceeded && <Text type="danger">Warnung: Die Summe der Raumflächen überschreitet die angegebene Gesamtwohnfläche!</Text>}
            </div>

            <Table 
              columns={roomColumns} 
              dataSource={rooms} 
              rowKey="id" 
              pagination={{ pageSize: 5 }}
              size="small"
              locale={{ emptyText: 'Noch keine Räume angelegt.' }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {/* Proportionale Raumaufteilung */}
          <RoomTreemap rooms={rooms} livingArea={totalLivingArea} />
        </Col>
      </Row>

      <Modal
        title={editingRoomId ? "Raum bearbeiten" : "Neuen Raum hinzufügen"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={roomForm} layout="vertical" onFinish={handleSaveRoom}>
          <Form.Item name="name" label="Raumname" rules={[{ required: true, message: 'Name ist erforderlich' }]}>
            <Input placeholder='z.B. "Bad OG"' />
          </Form.Item>
          <Form.Item name="type" label="Raumtyp" rules={[{ required: true, message: 'Typ ist erforderlich' }]}>
            <Select placeholder="Bitte auswählen">
              <Option value="Bad">Bad</Option>
              <Option value="Schlafzimmer">Schlafzimmer</Option>
              <Option value="Wohnbereich">Wohnbereich</Option>
              <Option value="Küche">Küche</Option>
              <Option value="Flur">Flur</Option>
              <Option value="Sonstiges">Sonstiges</Option>
            </Select>
          </Form.Item>
          <Form.Item name="area" label="Fläche (m²)" rules={[{ required: true, message: 'Fläche ist erforderlich' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="floorCovering" label="Bodenbelag" rules={[{ required: true }]}>
            <Input placeholder='z.B. "Parkett"' />
          </Form.Item>
          <Form.Item name="wallFinish" label="Wandbeschaffenheit" rules={[{ required: true }]}>
            <Input placeholder='z.B. "Gestrichen"' />
          </Form.Item>
          <Form.Item name="notes" label="Notizen">
            <Input.TextArea placeholder='z.B. "Farbcode Wand: RAL 9010"' rows={2} />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit">Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default PropertyView;
