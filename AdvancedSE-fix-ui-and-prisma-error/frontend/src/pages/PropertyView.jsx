import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  App,
  Table,
  Modal,
  Progress,
  Typography,
  Space,
  Statistic,
  Tag,
  Popconfirm,
  Empty
} from 'antd';
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  BorderOutlined,
  CalendarOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
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

  const fetchProperty = useCallback(async () => {
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
  }, [form, message, token]);

  useEffect(() => {
    // Initial load synchronizes the form with the persisted property record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProperty();
  }, [fetchProperty]);

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
    } catch {
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
    } catch {
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
    } catch {
      message.error('Fehler beim Löschen des Raums');
    }
  };

  const totalLivingArea = Form.useWatch('livingArea', form) || 0;

  const totalRoomArea = useMemo(() => {
    return rooms.reduce((sum, room) => sum + (Number(room.area) || 0), 0);
  }, [rooms]);

  const areaPercentage = totalLivingArea > 0 ? Math.round((totalRoomArea / totalLivingArea) * 100) : 0;
  const isAreaExceeded = totalRoomArea > totalLivingArea;
  const completionColor = isAreaExceeded ? '#ff4d4f' : areaPercentage >= 90 ? '#52c41a' : '#1677ff';

  const roomColumns = [
    {
      title: 'Raum',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.wallFinish || 'Keine Wanddetails'}</Text>
        </Space>
      )
    },
    {
      title: 'Typ',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="blue">{type}</Tag>
    },
    {
      title: 'Fläche (m²)',
      dataIndex: 'area',
      key: 'area',
      render: (area) => <Text strong>{area}</Text>
    },
    { title: 'Boden', dataIndex: 'floorCovering', key: 'floorCovering' },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenRoomModal(record)} />
          <Popconfirm
            title="Raum löschen?"
            description="Dieser Raum wird dauerhaft entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => handleDeleteRoom(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Objektverwaltung</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Immobilie im Überblick</Title>
          <Text type="secondary">Basisdaten, Wohnflächen und Räume an einem Ort.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => handleOpenRoomModal()}>
          Raum hinzufügen
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#f8fbff' }}>
            <Statistic title="Wohnfläche" value={totalLivingArea} suffix="m²" prefix={<HomeOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#f9fdfb' }}>
            <Statistic title="Erfasste Räume" value={rooms.length} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#fffaf2' }}>
            <Statistic title="Raumflächen" value={totalRoomArea} suffix="m²" prefix={<BorderOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#fbfbff' }}>
            <Statistic title="Abdeckung" value={areaPercentage} suffix="%" prefix={<CalendarOutlined />} valueStyle={{ color: completionColor }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} xl={11}>
          <Card
            title="Gebäude-Basisdaten"
            bordered={false}
            style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
            extra={<Tag color={propertyId ? 'green' : 'default'}>{propertyId ? 'Gespeichert' : 'Entwurf'}</Tag>}
          >
            <Form form={form} layout="vertical" onFinish={onSaveProperty}>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="address" label="Adresse" rules={[{ required: true, message: 'Adresse ist erforderlich' }]}>
                    <Input placeholder="Musterstraße 1, 1234 Musterstadt" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="plotArea" label="Grundstücksfläche (m²)" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="livingArea" label="Wohnfläche (m²)" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="usableArea" label="Nutzfläche (m²)" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="constructionYear" label="Baujahr" rules={[{ required: true, message: 'Erforderlich' }]}>
                    <InputNumber style={{ width: '100%' }} min={1800} max={new Date().getFullYear()} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="plotNumber" label="EZ (Optional)">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="cadastralMunicipality" label="Katastralgemeinde (Optional)">
                    <Input placeholder="Optional" />
                  </Form.Item>
                </Col>
              </Row>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                  Speichern
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={13}>
          <Card
            title="Raumbuch"
            bordered={false}
            style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
            extra={<Button icon={<PlusOutlined />} onClick={() => handleOpenRoomModal()}>Raum hinzufügen</Button>}
          >
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <Text strong>Raumflächen vs Wohnfläche</Text>
                <Text type={isAreaExceeded ? 'danger' : 'secondary'}>{totalRoomArea} / {totalLivingArea || 0} m²</Text>
              </div>
              <Progress
                percent={areaPercentage}
                status={isAreaExceeded ? 'exception' : 'active'}
                strokeColor={completionColor}
              />
              {isAreaExceeded && <Text type="danger">Die Summe der Raumflächen überschreitet die angegebene Wohnfläche.</Text>}
            </div>

            <Table
              columns={roomColumns}
              dataSource={rooms}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              size="middle"
              locale={{ emptyText: <Empty description="Noch keine Räume angelegt." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>
      </Row>

      <RoomTreemap rooms={rooms} livingArea={totalLivingArea} />

      <Modal
        title={editingRoomId ? 'Raum bearbeiten' : 'Neuen Raum hinzufügen'}
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
