import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  LinkOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import EntityWorkspace from '../components/common/EntityWorkspace';

const { Title, Text, Paragraph } = Typography;

const API_URL = 'http://localhost:5001/api/insurance';
const MAX_PHOTOS = 10;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const currency = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR'
});

const InsuranceClaims = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [policyForm] = Form.useForm();
  const [claimForm] = Form.useForm();
  const [policies, setPolicies] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [editingClaim, setEditingClaim] = useState(null);
  const [policyPdf, setPolicyPdf] = useState(null);
  const [claimPhotos, setClaimPhotos] = useState([]);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchInsurance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, { headers: authHeaders });
      setPolicies(res.data.policies || []);
      setClaims(res.data.claims || []);
    } catch (err) {
      if (err.response?.status === 404) {
        message.warning('Bitte legen Sie zuerst ein Objekt an.');
      } else {
        message.error('Versicherungsdaten konnten nicht geladen werden');
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message]);

  useEffect(() => {
    // Initial load synchronizes the insurance workspace with persisted records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchInsurance();
  }, [fetchInsurance]);

  const openPolicyModal = (policy = null) => {
    setEditingPolicy(policy);
    setPolicyPdf(null);
    if (policy) {
      policyForm.setFieldsValue(policy);
    } else {
      policyForm.resetFields();
    }
    setPolicyModalOpen(true);
  };

  const openClaimModal = (claim = null) => {
    setEditingClaim(claim);
    setClaimPhotos([]);
    if (claim) {
      claimForm.setFieldsValue({
        ...claim,
        claimDate: dayjs(claim.claimDate)
      });
    } else {
      claimForm.resetFields();
      claimForm.setFieldsValue({ claimDate: dayjs() });
    }
    setClaimModalOpen(true);
  };

  const handleSavePolicy = async (values) => {
    setSaving(true);
    try {
      let pdf;
      if (policyPdf) {
        pdf = {
          fileName: policyPdf.name,
          mimeType: policyPdf.type,
          fileSize: policyPdf.size,
          dataUrl: await readFileAsDataUrl(policyPdf)
        };
      }

      const payload = { ...values, pdf };
      if (editingPolicy) {
        await axios.put(`${API_URL}/policies/${editingPolicy.id}`, payload, { headers: authHeaders });
        message.success('Versicherung aktualisiert');
      } else {
        await axios.post(`${API_URL}/policies`, payload, { headers: authHeaders });
        message.success('Versicherung erfasst');
      }
      setPolicyModalOpen(false);
      await fetchInsurance();
    } catch (err) {
      message.error(err.response?.data?.error || 'Versicherung konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClaim = async (values) => {
    setSaving(true);
    try {
      const photos = await Promise.all(claimPhotos.map(async (file) => ({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        dataUrl: await readFileAsDataUrl(file)
      })));

      const payload = {
        ...values,
        claimDate: values.claimDate.toISOString(),
        photos,
        replacePhotos: claimPhotos.length > 0 || !editingClaim
      };

      if (editingClaim) {
        await axios.put(`${API_URL}/claims/${editingClaim.id}`, payload, { headers: authHeaders });
        message.success('Schadensfall aktualisiert');
      } else {
        await axios.post(`${API_URL}/claims`, payload, { headers: authHeaders });
        message.success('Schadensfall erfasst');
      }
      setClaimModalOpen(false);
      await fetchInsurance();
    } catch (err) {
      message.error(err.response?.data?.error || 'Schadensfall konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePolicy = async (id) => {
    try {
      await axios.delete(`${API_URL}/policies/${id}`, { headers: authHeaders });
      message.success('Versicherung gelöscht');
      await fetchInsurance();
    } catch {
      message.error('Versicherung konnte nicht gelöscht werden');
    }
  };

  const handleDeleteClaim = async (id) => {
    try {
      await axios.delete(`${API_URL}/claims/${id}`, { headers: authHeaders });
      message.success('Schadensfall gelöscht');
      await fetchInsurance();
    } catch {
      message.error('Schadensfall konnte nicht gelöscht werden');
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const res = await axios.get(`${API_URL}/documents/${documentId}/download`, { headers: authHeaders });
      const link = window.document.createElement('a');
      link.href = res.data.dataUrl;
      link.download = res.data.fileName;
      link.click();
    } catch {
      message.error('Dokument konnte nicht geöffnet werden');
    }
  };

  const handlePrepareExport = async (claim) => {
    try {
      const res = await axios.post(`${API_URL}/claims/${claim.id}/export`, {}, { headers: authHeaders });
      Modal.info({
        title: 'Export vorbereitet',
        content: (
          <Space direction="vertical">
            <Text>{res.data.includedPhotos} Fotos sind im Paket vorgemerkt.</Text>
            <Text copyable>{res.data.shareLink}</Text>
          </Space>
        )
      });
    } catch {
      message.error('Export konnte nicht vorbereitet werden');
    }
  };

  const policyColumns = [
    {
      title: 'Versicherer',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{provider}</Text>
          <Text type="secondary">Polizze {record.policyNumber}</Text>
        </Space>
      )
    },
    {
      title: 'Hotline',
      dataIndex: 'hotline',
      key: 'hotline',
      render: (hotline) => hotline || <Text type="secondary">Nicht hinterlegt</Text>
    },
    {
      title: 'Selbstbehalt',
      dataIndex: 'deductible',
      key: 'deductible',
      render: (deductible) => deductible === null || deductible === undefined ? '-' : currency.format(deductible)
    },
    {
      title: 'PDF',
      key: 'pdf',
      render: (_, record) => {
        const document = record.documents?.[0];
        return document ? (
          <Button type="link" icon={<FilePdfOutlined />} onClick={() => handleDownload(document.id)}>
            Polizze
          </Button>
        ) : <Text type="secondary">-</Text>;
      }
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openPolicyModal(record)} />
          <Popconfirm
            title="Versicherung löschen?"
            description="Polizze und PDF-Verknüpfung werden entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => handleDeletePolicy(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const claimColumns = [
    {
      title: 'Schaden',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{type}</Text>
          <Text type="secondary">{dayjs(record.claimDate).format('DD.MM.YYYY')}</Text>
        </Space>
      )
    },
    {
      title: 'Beschreibung',
      dataIndex: 'description',
      key: 'description',
      render: (description) => <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>{description}</Paragraph>
    },
    {
      title: 'Fotos',
      key: 'photos',
      render: (_, record) => <Tag color={record.photos?.length >= MAX_PHOTOS ? 'green' : 'blue'}>{record.photos?.length || 0}/{MAX_PHOTOS}</Tag>
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<LinkOutlined />} onClick={() => handlePrepareExport(record)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => openClaimModal(record)} />
          <Popconfirm
            title="Schadensfall löschen?"
            description="Der Schadensfall und seine Fotos werden entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => handleDeleteClaim(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const latestClaim = claims[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Dokumente & Versicherung</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Versicherungen und Schadensfälle</Title>
          <Text type="secondary">Gebäudepolizzen, Hotlines, Selbstbehalte und Schadenfotos fachlich getrennt verwalten.</Text>
        </div>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => openClaimModal()}>Schadensfall</Button>
          <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => openPolicyModal()}>Versicherung</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ background: '#f8fbff' }}>
            <Statistic title="Versicherungen" value={policies.length} prefix={<SafetyCertificateOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ background: '#f9fdfb' }}>
            <Statistic title="Schadensfälle" value={claims.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ background: '#fffaf2' }}>
            <Statistic title="Fotos im letzten Fall" value={latestClaim?.photos?.length || 0} suffix={`/ ${MAX_PHOTOS}`} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'policies',
            label: 'Gebäudeversicherungen',
            children: (
              <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
                <Table
                  columns={policyColumns}
                  dataSource={policies}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 6 }}
                  locale={{ emptyText: <Empty description="Noch keine Versicherungen erfasst." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
              </Card>
            )
          },
          {
            key: 'claims',
            label: 'Schadensfälle',
            children: (
              <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
                <EntityWorkspace
                  title="Schadensakte"
                  description="Suchen, prüfen und Exportpakete vorbereiten."
                  items={claims}
                  columns={claimColumns}
                  searchableFields={['type', 'description']}
                  filters={[
                    {
                      key: 'type',
                      allLabel: 'Alle Typen',
                      options: Array.from(new Set(claims.map((claim) => claim.type))).map((type) => ({ label: type, value: type }))
                    }
                  ]}
                  detailTitle={(claim) => claim.type}
                  emptyText="Noch keine Schadensfälle erfasst."
                  renderDetail={(claim) => (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text type="secondary">{dayjs(claim.claimDate).format('DD.MM.YYYY')}</Text>
                      <Paragraph>{claim.description}</Paragraph>
                      <Image.PreviewGroup>
                        <Row gutter={[8, 8]}>
                          {(claim.photos || []).map((photo) => (
                            <Col span={12} key={photo.id}>
                              <Button block icon={<DownloadOutlined />} onClick={() => handleDownload(photo.id)}>
                                {photo.fileName}
                              </Button>
                            </Col>
                          ))}
                        </Row>
                      </Image.PreviewGroup>
                    </Space>
                  )}
                />
              </Card>
            )
          }
        ]}
      />

      <Modal
        title={editingPolicy ? 'Versicherung bearbeiten' : 'Versicherung erfassen'}
        open={policyModalOpen}
        onCancel={() => setPolicyModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={policyForm} layout="vertical" onFinish={handleSavePolicy}>
          <Form.Item name="provider" label="Versicherer" rules={[{ required: true, message: 'Bitte Versicherer erfassen' }]}>
            <Input placeholder="z.B. Wiener Städtische" />
          </Form.Item>
          <Form.Item name="policyNumber" label="Polizzennummer" rules={[{ required: true, message: 'Bitte Polizzennummer erfassen' }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="hotline" label="Hotline">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="deductible" label="Selbstbehalt">
                <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Polizzen-PDF">
            <Upload
              accept="application/pdf"
              maxCount={1}
              beforeUpload={(file) => {
                if (file.type !== 'application/pdf') {
                  message.error('Bitte eine PDF-Datei auswählen');
                  return Upload.LIST_IGNORE;
                }
                setPolicyPdf(file);
                return false;
              }}
              onRemove={() => setPolicyPdf(null)}
            >
              <Button icon={<UploadOutlined />}>PDF auswählen</Button>
            </Upload>
            {editingPolicy?.documents?.[0] && !policyPdf && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Aktuell: {editingPolicy.documents[0].fileName}
              </Text>
            )}
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPolicyModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title={editingClaim ? 'Schadensfall bearbeiten' : 'Schadensfall erfassen'}
        open={claimModalOpen}
        onCancel={() => setClaimModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={claimForm} layout="vertical" onFinish={handleSaveClaim}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="claimDate" label="Datum" rules={[{ required: true, message: 'Bitte Datum wählen' }]}>
                <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="type" label="Typ" rules={[{ required: true, message: 'Bitte Typ erfassen' }]}>
                <Input placeholder="z.B. Wasser, Sturm, Glas" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Beschreibung" rules={[{ required: true, message: 'Bitte Beschreibung erfassen' }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label={`Fotos (${claimPhotos.length}/${MAX_PHOTOS})`}>
            <Upload
              accept="image/*"
              multiple
              beforeUpload={(file) => {
                if (!file.type.startsWith('image/')) {
                  message.error('Bitte nur Bilddateien auswählen');
                  return Upload.LIST_IGNORE;
                }
                if (claimPhotos.length >= MAX_PHOTOS) {
                  message.warning(`Maximal ${MAX_PHOTOS} Fotos pro Schadensfall`);
                  return Upload.LIST_IGNORE;
                }
                setClaimPhotos((current) => [...current, file].slice(0, MAX_PHOTOS));
                return false;
              }}
              onRemove={(file) => setClaimPhotos((current) => current.filter((item) => item.uid !== file.uid))}
              fileList={claimPhotos}
            >
              <Button icon={<UploadOutlined />}>Fotos auswählen</Button>
            </Upload>
            {editingClaim?.photos?.length > 0 && claimPhotos.length === 0 && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Aktuell gespeichert: {editingClaim.photos.length} Fotos
              </Text>
            )}
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setClaimModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default InsuranceClaims;
