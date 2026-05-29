import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Form, Input, Modal, Popconfirm, Rate, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Text, Title } = Typography;

const TRADE_OPTIONS = ['Elektrik', 'Sanitär', 'Heizung', 'Dach', 'Fenster', 'Maler', 'Boden', 'Generalunternehmer'];
const SORT_OPTIONS = [
  { value: 'companyName:asc', label: 'Firma A-Z' },
  { value: 'companyName:desc', label: 'Firma Z-A' },
  { value: 'trade:asc', label: 'Gewerk A-Z' },
  { value: 'updatedAt:desc', label: 'Zuletzt bearbeitet' }
];

const ContractorDirectory = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState();
  const [sortValue, setSortValue] = useState('companyName:asc');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchContractors = useCallback(async () => {
    const [sortBy, sortOrder] = sortValue.split(':');
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5001/api/contractors', {
        headers: authHeaders,
        params: {
          search: search || undefined,
          trade: tradeFilter || undefined,
          sortBy,
          sortOrder
        }
      });
      setContractors(res.data);
    } catch {
      message.error('Fehler beim Laden der Handwerker');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message, search, sortValue, tradeFilter]);

  useEffect(() => {
    // Synchronizes the table with persisted contacts and active filters.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchContractors();
  }, [fetchContractors]);

  const availableTrades = useMemo(() => {
    const storedTrades = contractors.map((contractor) => contractor.trade).filter(Boolean);
    return Array.from(new Set([...TRADE_OPTIONS, ...storedTrades])).sort((a, b) => a.localeCompare(b));
  }, [contractors]);

  const openModal = (contractor = null) => {
    setEditingId(contractor?.id || null);
    if (contractor) {
      form.setFieldsValue(contractor);
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const saveContractor = async (values) => {
    try {
      if (editingId) {
        await axios.put(`http://localhost:5001/api/contractors/${editingId}`, values, { headers: authHeaders });
        message.success('Handwerker aktualisiert');
      } else {
        await axios.post('http://localhost:5001/api/contractors', values, { headers: authHeaders });
        message.success('Handwerker angelegt');
      }
      setModalOpen(false);
      await fetchContractors();
    } catch {
      message.error('Fehler beim Speichern des Handwerkers');
    }
  };

  const deleteContractor = async (id) => {
    try {
      await axios.delete(`http://localhost:5001/api/contractors/${id}`, { headers: authHeaders });
      message.success('Handwerker gelöscht');
      await fetchContractors();
    } catch {
      message.error('Fehler beim Löschen des Handwerkers');
    }
  };

  const columns = [
    {
      title: 'Firma',
      dataIndex: 'companyName',
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.contactPerson || 'Kein Ansprechpartner'}</Text>
        </Space>
      )
    },
    { title: 'Gewerk', dataIndex: 'trade', render: (value) => <Tag color="blue">{value}</Tag> },
    { title: 'Telefon', dataIndex: 'phone' },
    { title: 'E-Mail', dataIndex: 'email' },
    {
      title: 'Bewertung',
      render: (_, record) => {
        if (!Number.isFinite(record.averageRating) || !record.ratingCount) {
          return <Text type="secondary">Noch keine Bewertung</Text>;
        }

        return (
          <Space direction="vertical" size={0}>
            <Rate disabled allowHalf value={record.averageRating} style={{ fontSize: 14 }} />
            <Text type="secondary">{record.averageRating.toFixed(1)} aus {record.ratingCount}</Text>
          </Space>
        );
      }
    },
    {
      title: 'Notizen / Erfahrung',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.experience || record.notes || 'Keine Notizen'}</Text>
          {record.experience && record.notes && <Text type="secondary">{record.notes}</Text>}
        </Space>
      )
    },
    {
      title: '',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm
            title="Handwerker löschen?"
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => deleteContractor(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Handwerker-Verzeichnis</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Handwerker verwalten</Title>
          <Text type="secondary">Firmen, Gewerke, Kontaktdaten und eigene Erfahrungen zentral verwalten.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Handwerker anlegen
        </Button>
      </div>

      <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={10}>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Suche nach Firma, Gewerk, Kontakt, Adresse oder Notiz"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} lg={7}>
            <Select
              allowClear
              placeholder="Gewerk filtern"
              value={tradeFilter}
              onChange={setTradeFilter}
              options={availableTrades.map((value) => ({ value, label: value }))}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} lg={7}>
            <Select value={sortValue} onChange={setSortValue} options={SORT_OPTIONS} style={{ width: '100%' }} />
          </Col>
        </Row>

        <Table columns={columns} dataSource={contractors} rowKey="id" loading={loading} pagination={{ pageSize: 8 }} />
      </Card>

      <Modal
        title={editingId ? 'Handwerker bearbeiten' : 'Handwerker anlegen'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={saveContractor}>
          <Form.Item name="companyName" label="Firmenname" rules={[{ required: true, message: 'Firmenname ist erforderlich' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trade" label="Gewerk" rules={[{ required: true, message: 'Gewerk ist erforderlich' }]}>
            <Select
              showSearch
              options={availableTrades.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item name="contactPerson" label="Ansprechpartner">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Telefon">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="E-Mail">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Adresse">
            <Input />
          </Form.Item>
          <Form.Item name="experience" label="Erfahrung / Spezialisierung">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notizen">
            <Input.TextArea rows={3} />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit">Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ContractorDirectory;
