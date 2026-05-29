import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload
} from 'antd';
import {
  BellOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlusOutlined,
  UploadOutlined,
  WalletOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const TAX_TYPES = ['Grundsteuer', 'Müll', 'Kanal', 'Wasser'];
const INTERVALS = [
  { label: 'Monatlich', value: 'MONATLICH' },
  { label: 'Quartalsweise', value: 'QUARTALSWEISE' },
  { label: 'Halbjährlich', value: 'HALBJÄHRLICH' },
  { label: 'Jährlich', value: 'JÄHRLICH' }
];

const currency = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR'
});

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const daysUntil = (value) => dayjs(value).startOf('day').diff(dayjs().startOf('day'), 'day');

const MunicipalTaxes = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [taxes, setTaxes] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchTaxes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5001/api/municipal-taxes', {
        headers: authHeaders
      });
      setTaxes(res.data.taxes || []);
      setTrend(res.data.trend || []);
    } catch (err) {
      if (err.response?.status === 404) {
        message.warning('Bitte legen Sie zuerst ein Objekt an.');
      } else {
        message.error('Gemeindesteuern konnten nicht geladen werden');
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message]);

  useEffect(() => {
    // Initial load synchronizes the tax dashboard with persisted records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTaxes();
  }, [fetchTaxes]);

  const upcomingTaxes = useMemo(() => {
    return taxes
      .filter((tax) => {
        const days = daysUntil(tax.dueDate);
        return days >= 0 && days <= 14;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [taxes]);

  const totalAnnual = useMemo(() => {
    const currentYear = String(new Date().getFullYear());
    return trend.find((item) => item.year === currentYear)?.total || 0;
  }, [trend]);

  const nextDue = useMemo(() => {
    return taxes
      .filter((tax) => daysUntil(tax.dueDate) >= 0)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
  }, [taxes]);

  const openModal = (tax = null) => {
    setEditingTax(tax);
    setSelectedFile(null);
    if (tax) {
      form.setFieldsValue({
        ...tax,
        dueDate: dayjs(tax.dueDate)
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ interval: 'JÄHRLICH' });
    }
    setModalOpen(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      let document;
      if (selectedFile) {
        document = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          dataUrl: await readFileAsDataUrl(selectedFile)
        };
      }

      const payload = {
        ...values,
        dueDate: values.dueDate.toISOString(),
        document
      };

      if (editingTax) {
        await axios.put(`http://localhost:5001/api/municipal-taxes/${editingTax.id}`, payload, {
          headers: authHeaders
        });
        message.success('Abgabe aktualisiert');
      } else {
        await axios.post('http://localhost:5001/api/municipal-taxes', payload, {
          headers: authHeaders
        });
        message.success('Abgabe erfasst');
      }

      setModalOpen(false);
      await fetchTaxes();
    } catch {
      message.error('Abgabe konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:5001/api/municipal-taxes/${id}`, {
        headers: authHeaders
      });
      message.success('Abgabe gelöscht');
      await fetchTaxes();
    } catch {
      message.error('Abgabe konnte nicht gelöscht werden');
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const res = await axios.get(`http://localhost:5001/api/municipal-taxes/documents/${documentId}/download`, {
        headers: authHeaders
      });
      const link = window.document.createElement('a');
      link.href = res.data.dataUrl;
      link.download = res.data.fileName;
      link.click();
    } catch {
      message.error('Dokument konnte nicht geöffnet werden');
    }
  };

  const columns = [
    {
      title: 'Abgabe',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{type}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.notes || 'Keine Notiz'}</Text>
        </Space>
      )
    },
    {
      title: 'Betrag',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <Text strong>{currency.format(amount)}</Text>
    },
    {
      title: 'Intervall',
      dataIndex: 'interval',
      key: 'interval',
      render: (interval) => <Tag>{INTERVALS.find((item) => item.value === interval)?.label || interval}</Tag>
    },
    {
      title: 'Fälligkeit',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate) => {
        const days = daysUntil(dueDate);
        return (
          <Space direction="vertical" size={0}>
            <Text>{dayjs(dueDate).format('DD.MM.YYYY')}</Text>
            {days >= 0 && days <= 14 && <Text type="warning" style={{ fontSize: 12 }}>in {days} Tagen</Text>}
          </Space>
        );
      }
    },
    {
      title: 'Bescheid',
      dataIndex: 'document',
      key: 'document',
      render: (document) => document ? (
        <Button type="link" icon={<FilePdfOutlined />} onClick={() => handleDownload(document.id)}>
          PDF
        </Button>
      ) : <Text type="secondary">-</Text>
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm
            title="Abgabe löschen?"
            description="Der Eintrag, die Erinnerung und der Bescheid werden entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => handleDelete(record.id)}
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
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Gemeindesteuern & Abgaben</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Wiederkehrende Hausabgaben</Title>
          <Text type="secondary">Grundsteuer, Müll, Kanal und Wasser inklusive Bescheiden und Fälligkeiten.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openModal()}>
          Abgabe erfassen
        </Button>
      </div>

      {upcomingTaxes.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<BellOutlined />}
          message={`${upcomingTaxes.length} Fälligkeit innerhalb der nächsten 14 Tage`}
          description={upcomingTaxes.map((tax) => `${tax.type}: ${dayjs(tax.dueDate).format('DD.MM.YYYY')}`).join(' · ')}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ background: '#f8fbff' }}>
            <Statistic title="Erfasste Abgaben" value={taxes.length} prefix={<WalletOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ background: '#f9fdfb' }}>
            <Statistic title="Kosten dieses Jahr" value={totalAnnual} precision={2} suffix="EUR" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ background: '#fffaf2' }}>
            <Statistic
              title="Nächste Fälligkeit"
              value={nextDue ? dayjs(nextDue.dueDate).format('DD.MM.YYYY') : '-'}
              prefix={<BellOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} xl={16}>
          <Card bordered={false} title="Abgabenliste" style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <Table
              columns={columns}
              dataSource={taxes}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 6 }}
              locale={{ emptyText: <Empty description="Noch keine Abgaben erfasst." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card bordered={false} title="Jährlicher Kostentrend" style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            {trend.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis width={58} tickFormatter={(value) => `${value}€`} />
                    <Tooltip formatter={(value) => currency.format(value)} />
                    <Line type="monotone" dataKey="total" name="Gesamt" stroke="#1677ff" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="Noch keine Trenddaten." image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingTax ? 'Abgabe bearbeiten' : 'Abgabe erfassen'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="type" label="Abgabenart" rules={[{ required: true, message: 'Bitte Abgabenart wählen' }]}>
            <Select options={TAX_TYPES.map((type) => ({ label: type, value: type }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="amount" label="Betrag" rules={[{ required: true, message: 'Bitte Betrag erfassen' }]}>
                <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="interval" label="Zahlungsintervall" rules={[{ required: true }]}>
                <Select options={INTERVALS} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dueDate" label="Fälligkeit" rules={[{ required: true, message: 'Bitte Fälligkeit wählen' }]}>
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Steuerbescheid">
            <Upload
              accept="application/pdf"
              maxCount={1}
              beforeUpload={(file) => {
                if (file.type !== 'application/pdf') {
                  message.error('Bitte eine PDF-Datei auswählen');
                  return Upload.LIST_IGNORE;
                }
                setSelectedFile(file);
                return false;
              }}
              onRemove={() => setSelectedFile(null)}
            >
              <Button icon={<UploadOutlined />}>PDF auswählen</Button>
            </Upload>
            {editingTax?.document && !selectedFile && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Aktuell: {editingTax.document.fileName}
              </Text>
            )}
          </Form.Item>
          <Form.Item name="notes" label="Notiz">
            <Input.TextArea rows={3} placeholder="z.B. Bescheidnummer, Kundennummer oder Berechnungsgrundlage" />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MunicipalTaxes;
