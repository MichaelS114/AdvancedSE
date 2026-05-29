import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlusOutlined,
  TrophyOutlined,
  UploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Text, Title } = Typography;

const currency = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const dateFormatter = new Intl.DateTimeFormat('de-AT');

const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '-');
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : undefined);

const getServiceDescriptions = (offer, type) => (
  offer.services?.filter((service) => service.type === type).map((service) => service.description) || []
);

const getDeviation = (amount, budget) => {
  const absolute = amount - (Number(budget) || 0);
  const percent = budget > 0 ? (absolute / budget) * 100 : 0;
  return { absolute, percent };
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const OfferManagement = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [offerForm] = Form.useForm();
  const [projectForm] = Form.useForm();
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [offers, setOffers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfMeta, setPdfMeta] = useState(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedOffers = useMemo(
    () => offers.filter((offer) => offer.projectId === selectedProjectId),
    [offers, selectedProjectId]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, contractorsRes, offersRes] = await Promise.all([
        axios.get('http://localhost:5001/api/projects', { headers: authHeaders }),
        axios.get('http://localhost:5001/api/contractors', { headers: authHeaders }),
        axios.get('http://localhost:5001/api/offers', { headers: authHeaders })
      ]);
      setProjects(projectsRes.data);
      setContractors(contractorsRes.data);
      setOffers(offersRes.data);
      setSelectedProjectId((current) => current || projectsRes.data[0]?.id || null);
    } catch {
      message.error('Fehler beim Laden der Angebotsdaten');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message]);

  useEffect(() => {
    // Initial load synchronizes the offer workspace with persisted records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const openOfferModal = (offer = null) => {
    setEditingOfferId(offer?.id || null);
    setPdfPreview(offer?.pdfDataUrl || null);
    setPdfMeta(offer?.pdfFileName ? { fileName: offer.pdfFileName, mimeType: offer.pdfMimeType } : null);
    if (offer) {
      offerForm.setFieldsValue({
        projectId: offer.projectId,
        contractorId: offer.contractorId,
        price: offer.amount,
        validUntil: toDateInput(offer.validUntil),
        scopeDescription: offer.scopeDescription,
        availabilityStart: toDateInput(offer.availabilityStart),
        durationDays: offer.durationDays,
        includedServices: getServiceDescriptions(offer, 'INCLUDED'),
        excludedServices: getServiceDescriptions(offer, 'EXCLUDED'),
        notes: offer.notes
      });
    } else {
      offerForm.resetFields();
      offerForm.setFieldsValue({
        projectId: selectedProjectId,
        includedServices: [''],
        excludedServices: ['']
      });
    }
    setOfferModalOpen(true);
  };

  const saveOffer = async (values) => {
    const payload = {
      ...values,
      pdfFileName: pdfMeta?.fileName || null,
      pdfMimeType: pdfMeta?.mimeType || null,
      pdfDataUrl: pdfPreview || null
    };

    try {
      if (editingOfferId) {
        await axios.put(`http://localhost:5001/api/offers/${editingOfferId}`, payload, { headers: authHeaders });
        message.success('Angebot aktualisiert');
      } else {
        await axios.post('http://localhost:5001/api/offers', payload, { headers: authHeaders });
        message.success('Angebot angelegt');
      }
      setOfferModalOpen(false);
      void fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern des Angebots');
    }
  };

  const saveProject = async (values) => {
    try {
      const res = await axios.post('http://localhost:5001/api/projects', values, { headers: authHeaders });
      message.success('Projekt angelegt');
      setProjectModalOpen(false);
      setSelectedProjectId(res.data.id);
      projectForm.resetFields();
      void fetchData();
    } catch {
      message.error('Fehler beim Erstellen des Projekts');
    }
  };

  const deleteOffer = async (id) => {
    try {
      await axios.delete(`http://localhost:5001/api/offers/${id}`, { headers: authHeaders });
      message.success('Angebot gelöscht');
      void fetchData();
    } catch {
      message.error('Fehler beim Löschen des Angebots');
    }
  };

  const handlePdfUpload = async (file) => {
    if (file.type !== 'application/pdf') {
      message.warning('Bitte ein PDF hochladen');
      return Upload.LIST_IGNORE;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setPdfPreview(dataUrl);
    setPdfMeta({ fileName: file.name, mimeType: file.type });
    return false;
  };

  const winnerIds = useMemo(() => {
    const withStart = selectedOffers.filter((offer) => offer.availabilityStart);
    const cheapest = selectedOffers.reduce((best, offer) => (!best || offer.amount < best.amount ? offer : best), null);
    const earliest = withStart.reduce((best, offer) => (!best || new Date(offer.availabilityStart) < new Date(best.availabilityStart) ? offer : best), null);
    const shortest = selectedOffers.reduce((best, offer) => (!best || offer.durationDays < best.durationDays ? offer : best), null);
    return {
      cheapest: cheapest?.id,
      earliest: earliest?.id,
      shortest: shortest?.id
    };
  }, [selectedOffers]);

  const offerColumns = [
    {
      title: 'Angebot',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.contractor.companyName}</Text>
          <Text type="secondary">{record.project.title}</Text>
        </Space>
      )
    },
    { title: 'Preis', dataIndex: 'amount', render: (value) => currency.format(value) },
    { title: 'Gültig bis', dataIndex: 'validUntil', render: formatDate },
    { title: 'Start', dataIndex: 'availabilityStart', render: formatDate },
    { title: 'Dauer', dataIndex: 'durationDays', render: (value) => `${value} Tage` },
    {
      title: 'PDF',
      render: (_, record) => record.pdfDataUrl ? <Tag icon={<FilePdfOutlined />} color="red">PDF</Tag> : <Tag>Kein PDF</Tag>
    },
    {
      title: '',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openOfferModal(record)} />
          <Popconfirm
            title="Angebot löschen?"
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => deleteOffer(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const matrixColumns = [
    {
      title: 'Kriterium',
      dataIndex: 'label',
      fixed: 'left',
      width: 210,
      render: (value) => <Text strong>{value}</Text>
    },
    ...selectedOffers.map((offer) => ({
      title: (
        <Space direction="vertical" size={0}>
          <Text strong>{offer.contractor.companyName}</Text>
          <Text type="secondary">{offer.contractor.trade}</Text>
        </Space>
      ),
      dataIndex: offer.id,
      width: 260,
      render: (_, row) => row.render(offer)
    }))
  ];

  const winnerTag = (label) => (
    <Tag color="green" icon={<TrophyOutlined />} style={{ marginLeft: 8 }}>{label}</Tag>
  );

  const matrixRows = [
    {
      key: 'price',
      label: 'Preis und Budgetabweichung',
      render: (offer) => {
        const deviation = getDeviation(offer.amount, selectedProject?.targetBudget);
        return (
          <Space direction="vertical" size={2}>
            <Text strong>{currency.format(offer.amount)}{winnerIds.cheapest === offer.id ? winnerTag('günstigster Preis') : null}</Text>
            <Text type={deviation.absolute > 0 ? 'danger' : 'success'}>
              {deviation.absolute >= 0 ? '+' : ''}{currency.format(deviation.absolute)} ({deviation.percent.toFixed(1)}%)
            </Text>
          </Space>
        );
      }
    },
    {
      key: 'scope',
      label: 'Leistungsumfang',
      render: (offer) => <Text>{offer.scopeDescription}</Text>
    },
    {
      key: 'included',
      label: 'Inklusivleistungen',
      render: (offer) => (
        <Space wrap>
          {getServiceDescriptions(offer, 'INCLUDED').map((item) => <Tag color="blue" key={item}>{item}</Tag>)}
        </Space>
      )
    },
    {
      key: 'excluded',
      label: 'Exklusivleistungen',
      render: (offer) => (
        <Space wrap>
          {getServiceDescriptions(offer, 'EXCLUDED').map((item) => <Tag key={item}>{item}</Tag>)}
        </Space>
      )
    },
    {
      key: 'start',
      label: 'Starttermin vs Wunschstart',
      render: (offer) => {
        const diffDays = selectedProject?.desiredStartDate && offer.availabilityStart
          ? Math.ceil((new Date(offer.availabilityStart) - new Date(selectedProject.desiredStartDate)) / 86400000)
          : null;
        return (
          <Space direction="vertical" size={2}>
            <Text>{formatDate(offer.availabilityStart)}{winnerIds.earliest === offer.id ? winnerTag('frühester Start') : null}</Text>
            {diffDays !== null ? <Text type={diffDays > 0 ? 'warning' : 'success'}>{diffDays >= 0 ? '+' : ''}{diffDays} Tage zum Wunschstart</Text> : null}
          </Space>
        );
      }
    },
    {
      key: 'duration',
      label: 'Projektdauer',
      render: (offer) => (
        <Text>{offer.durationDays} Tage{winnerIds.shortest === offer.id ? winnerTag('kürzeste Dauer') : null}</Text>
      )
    }
  ];

  const renderServiceList = (fieldName, label) => (
    <Form.List name={fieldName}>
      {(fields, { add, remove }) => (
        <Form.Item label={label}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {fields.map((field) => (
              <Space key={field.key} align="baseline" style={{ width: '100%' }}>
                <Form.Item {...field} noStyle>
                  <Input placeholder="Leistung beschreiben" style={{ width: 360 }} />
                </Form.Item>
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
              </Space>
            ))}
            <Button icon={<PlusOutlined />} onClick={() => add('')}>
              Leistung hinzufügen
            </Button>
          </Space>
        </Form.Item>
      )}
    </Form.List>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Angebotsmanagement</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Angebote erfassen und vergleichen</Title>
          <Text type="secondary">Projektzuordnung, Handwerker, PDF, Preis und Leistungen strukturiert an einem Ort.</Text>
        </div>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setProjectModalOpen(true)}>Projekt anlegen</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openOfferModal()} disabled={!projects.length || !contractors.length}>
            Angebot erfassen
          </Button>
        </Space>
      </div>

      <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
        <Tabs
          items={[
            {
              key: 'offers',
              label: 'Angebote',
              children: (
                <Table
                  columns={offerColumns}
                  dataSource={offers}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 8 }}
                  locale={{ emptyText: <Empty description="Noch keine Angebote erfasst." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
              )
            },
            {
              key: 'matrix',
              label: 'Vergleichsmatrix',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Row gutter={[16, 16]} align="bottom">
                    <Col xs={24} md={10}>
                      <Text strong>Projekt</Text>
                      <Select
                        value={selectedProjectId}
                        onChange={setSelectedProjectId}
                        style={{ width: '100%', marginTop: 8 }}
                        options={projects.map((project) => ({ value: project.id, label: project.title }))}
                        placeholder="Projekt auswählen"
                      />
                    </Col>
                    <Col xs={24} md={14}>
                      {selectedProject ? (
                        <Descriptions size="small" column={3}>
                          <Descriptions.Item label="Budget">{currency.format(selectedProject.targetBudget || 0)}</Descriptions.Item>
                          <Descriptions.Item label="Wunschstart">{formatDate(selectedProject.desiredStartDate)}</Descriptions.Item>
                          <Descriptions.Item label="Kategorie">{selectedProject.category}</Descriptions.Item>
                        </Descriptions>
                      ) : null}
                    </Col>
                  </Row>

                  {selectedOffers.length ? (
                    <Table
                      columns={matrixColumns}
                      dataSource={matrixRows}
                      rowKey="key"
                      pagination={false}
                      scroll={{ x: 240 + selectedOffers.length * 260 }}
                      bordered
                    />
                  ) : (
                    <Empty description="Für dieses Projekt gibt es noch keine Angebote." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editingOfferId ? 'Angebot bearbeiten' : 'Angebot erfassen'}
        open={offerModalOpen}
        onCancel={() => setOfferModalOpen(false)}
        footer={null}
        width={920}
        destroyOnClose
      >
        <Form form={offerForm} layout="vertical" onFinish={saveOffer}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="projectId" label="Projekt" rules={[{ required: true, message: 'Projekt ist erforderlich' }]}>
                <Select options={projects.map((project) => ({ value: project.id, label: project.title }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contractorId" label="Handwerker" rules={[{ required: true, message: 'Handwerker ist erforderlich' }]}>
                <Select options={contractors.map((contractor) => ({ value: contractor.id, label: `${contractor.companyName} (${contractor.trade})` }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="price" label="Preis" rules={[{ required: true, message: 'Preis ist erforderlich' }]}>
                <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="validUntil" label="Gültig bis" rules={[{ required: true, message: 'Gültigkeit ist erforderlich' }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="availabilityStart" label="Verfügbar ab" rules={[{ required: true, message: 'Verfügbarkeit ist erforderlich' }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="durationDays" label="Projektdauer (Tage)" rules={[{ required: true, message: 'Dauer ist erforderlich' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="scopeDescription" label="Leistungsumfang" rules={[{ required: true, message: 'Leistungsumfang ist erforderlich' }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>{renderServiceList('includedServices', 'Inklusivleistungen')}</Col>
            <Col xs={24} md={12}>{renderServiceList('excludedServices', 'Exklusivleistungen')}</Col>
            <Col xs={24}>
              <Form.Item name="notes" label="Notizen">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Upload accept="application/pdf" maxCount={1} beforeUpload={handlePdfUpload} showUploadList={false}>
                <Button icon={<UploadOutlined />}>Angebots-PDF hochladen</Button>
              </Upload>
              {pdfMeta ? <Text style={{ marginLeft: 12 }}>{pdfMeta.fileName}</Text> : null}
              {pdfPreview ? (
                <iframe
                  title="Angebots-PDF Vorschau"
                  src={pdfPreview}
                  style={{ width: '100%', height: 360, border: '1px solid #d9d9d9', borderRadius: 8, marginTop: 12 }}
                />
              ) : null}
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setOfferModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit">Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Projekt anlegen"
        open={projectModalOpen}
        onCancel={() => setProjectModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={projectForm} layout="vertical" onFinish={saveProject}>
          <Form.Item name="title" label="Titel" rules={[{ required: true, message: 'Titel ist erforderlich' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Kategorie" rules={[{ required: true, message: 'Kategorie ist erforderlich' }]}>
            <Select options={['Sanierung', 'Wartung', 'Modernisierung', 'Reparatur', 'Ausbau'].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="targetBudget" label="Zielbudget">
            <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="desiredStartDate" label="Wunschstart">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="description" label="Beschreibung">
            <Input.TextArea rows={3} />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setProjectModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit">Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default OfferManagement;
