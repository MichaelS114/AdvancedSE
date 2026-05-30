import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  Rate,
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
  CheckCircleOutlined,
  DeleteOutlined,
  EuroOutlined,
  FilePdfOutlined,
  PlusOutlined,
  ProjectOutlined,
  StarOutlined,
  UploadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const PROJECTS_API = 'http://localhost:5001/api/projects';
const CONTRACTORS_API = 'http://localhost:5001/api/contractors';

const statusLabels = {
  IN_PLANUNG: { label: 'In Planung', color: 'blue' },
  BEAUFTRAGT: { label: 'Beauftragt', color: 'green' },
  IN_UMSETZUNG: { label: 'In Umsetzung', color: 'gold' },
  ABGESCHLOSSEN: { label: 'Abgeschlossen', color: 'purple' },
  STORNIERT: { label: 'Storniert', color: 'red' }
};

const offerStatusLabels = {
  PENDING: { label: 'Offen/Wartend', color: 'gold' },
  ACCEPTED: { label: 'Angenommen', color: 'green' },
  REJECTED: { label: 'Abgelehnt', color: 'red' }
};
const TRADE_OPTIONS = ['Elektrik', 'Sanitär', 'Heizung', 'Dach', 'Fenster', 'Maler', 'Boden', 'Generalunternehmer'];

const euro = new Intl.NumberFormat('de-AT', {
  style: 'currency',
  currency: 'EUR'
});

const percent = new Intl.NumberFormat('de-AT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const extractPdf = async (uploadValue) => {
  const uploadFile = Array.isArray(uploadValue) ? uploadValue[0] : uploadValue?.fileList?.[0] || uploadValue?.file;
  const file = uploadFile?.originFileObj;
  if (!file) return {};

  return {
    fileName: file.name,
    dataUrl: await fileToDataUrl(file)
  };
};

const pdfUploadProps = {
  accept: 'application/pdf',
  beforeUpload: () => false,
  maxCount: 1
};

const normFile = (event) => (Array.isArray(event) ? event : event?.fileList);

const ProjectTendering = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [projectForm] = Form.useForm();
  const [offerForm] = Form.useForm();
  const [acceptForm] = Form.useForm();
  const [invoiceForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [offerModalProject, setOfferModalProject] = useState(null);
  const [acceptingOffer, setAcceptingOffer] = useState(null);
  const [invoiceProject, setInvoiceProject] = useState(null);
  const [reviewProject, setReviewProject] = useState(null);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const acceptedOffer = selectedProject?.acceptedOffer || selectedProject?.offers?.find((offer) => offer.status === 'ACCEPTED');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(PROJECTS_API, { headers: authHeaders });
      setProjects(res.data);
      if (!selectedProjectId && res.data.length) {
        setSelectedProjectId(res.data[0].id);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Laden der Projekte');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message, selectedProjectId]);

  const fetchContractors = useCallback(async () => {
    try {
      const res = await axios.get(CONTRACTORS_API, { headers: authHeaders });
      setContractors(res.data);
    } catch {
      message.error('Fehler beim Laden der Handwerker');
    }
  }, [authHeaders, message]);

  useEffect(() => {
    // Initial load synchronizes tendering data with persisted records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProjects();
    void fetchContractors();
  }, [fetchContractors, fetchProjects]);

  const handleCreateProject = async (values) => {
    setSaving(true);
    try {
      const res = await axios.post(PROJECTS_API, values, { headers: authHeaders });
      setProjectModalOpen(false);
      projectForm.resetFields();
      setSelectedProjectId(res.data.id);
      await fetchProjects();
      message.success('Projekt angelegt');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern des Projekts');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await axios.delete(`${PROJECTS_API}/${projectId}`, { headers: authHeaders });
      setSelectedProjectId(null);
      await fetchProjects();
      message.success('Projekt gelöscht');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Löschen des Projekts');
    }
  };

  const handleCreateOffer = async (values) => {
    const pdf = await extractPdf(values.pdf);
    setSaving(true);
    try {
      await axios.post(`${PROJECTS_API}/${offerModalProject.id}/offers`, {
        contractorId: values.contractorId,
        amount: values.amount,
        notes: values.notes,
        pdfFileName: pdf.fileName,
        pdfDataUrl: pdf.dataUrl
      }, { headers: authHeaders });

      offerForm.resetFields();
      setOfferModalProject(null);
      await fetchProjects();
      message.success('Angebot erfasst');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern des Angebots');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptOffer = async (values) => {
    const orderPdf = await extractPdf(values.orderConfirmationPdf);
    const contractPdf = await extractPdf(values.finalContractPdf);
    setSaving(true);
    try {
      await axios.post(`${PROJECTS_API}/offers/${acceptingOffer.id}/accept`, {
        orderConfirmationFileName: orderPdf.fileName,
        orderConfirmationDataUrl: orderPdf.dataUrl,
        finalContractFileName: contractPdf.fileName,
        finalContractDataUrl: contractPdf.dataUrl
      }, { headers: authHeaders });

      acceptForm.resetFields();
      setAcceptingOffer(null);
      await fetchProjects();
      message.success('Angebot angenommen und Projekt beauftragt');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Annehmen des Angebots');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalInvoice = async (values) => {
    const invoicePdf = await extractPdf(values.invoicePdf);
    setSaving(true);
    try {
      const res = await axios.post(`${PROJECTS_API}/${invoiceProject.id}/final-invoice`, {
        finalInvoiceAmount: values.finalInvoiceAmount,
        finalInvoiceFileName: invoicePdf.fileName,
        finalInvoiceDataUrl: invoicePdf.dataUrl
      }, { headers: authHeaders });

      invoiceForm.resetFields();
      setInvoiceProject(null);
      await fetchProjects();
      if (res.data.invoiceDeviationWarning) {
        message.warning('Schlussrechnung weicht mehr als 5 % vom Angebot ab');
      } else {
        message.success('Schlussrechnung gespeichert');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern der Schlussrechnung');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (values) => {
    setSaving(true);
    try {
      await axios.post(`${PROJECTS_API}/${reviewProject.id}/review`, values, { headers: authHeaders });
      reviewForm.resetFields();
      setReviewProject(null);
      await fetchProjects();
      await fetchContractors();
      message.success('Bewertung gespeichert');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern der Bewertung');
    } finally {
      setSaving(false);
    }
  };

  const projectColumns = [
    {
      title: 'Projekt',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{title}</Text>
          <Paragraph ellipsis={{ rows: 1 }} style={{ marginBottom: 0, maxWidth: 300 }}>
            {record.description || 'Keine Beschreibung'}
          </Paragraph>
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <Tag color={statusLabels[value]?.color}>{statusLabels[value]?.label || value}</Tag>
    },
    {
      title: 'Angebote',
      key: 'offers',
      render: (_, record) => record.offers?.length || 0
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="Projekt löschen?"
            description="Alle Angebote und Bewertungen zu diesem Projekt werden entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => handleDeleteProject(record.id)}
          >
            <Button danger type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const offerColumns = [
    {
      title: 'Handwerker',
      key: 'contractor',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.contractor?.companyName}</Text>
          <Text type="secondary">{record.contractor?.trade}</Text>
        </Space>
      )
    },
    {
      title: 'Betrag',
      dataIndex: 'amount',
      key: 'amount',
      render: (value) => euro.format(value)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <Tag color={offerStatusLabels[value]?.color}>{offerStatusLabels[value]?.label || value}</Tag>
    },
    {
      title: 'PDF',
      key: 'pdf',
      render: (_, record) => record.pdfFileName ? <Tag icon={<FilePdfOutlined />}>{record.pdfFileName}</Tag> : <Text type="secondary">Kein PDF</Text>
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          disabled={record.status === 'ACCEPTED' || selectedProject?.status === 'ABGESCHLOSSEN'}
          onClick={() => setAcceptingOffer(record)}
        >
          Annehmen
        </Button>
      )
    }
  ];

  const totalOffers = projects.reduce((sum, project) => sum + (project.offers?.length || 0), 0);
  const commissionedProjects = projects.filter((project) => project.status === 'BEAUFTRAGT').length;
  const completedProjects = projects.filter((project) => project.status === 'ABGESCHLOSSEN').length;
  const deviation = selectedProject?.invoiceDeviationPercent;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Vergabe und Abschluss</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Instandhaltungsprojekte</Title>
          <Text type="secondary">Angebote vergleichen, beauftragen, Schlussrechnung prüfen und Handwerker bewerten.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setProjectModalOpen(true)}>
          Projekt anlegen
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#f7fbff' }}>
            <Statistic title="Projekte" value={projects.length} prefix={<ProjectOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#fffaf2' }}>
            <Statistic title="Angebote" value={totalOffers} prefix={<EuroOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#f7fdf9' }}>
            <Statistic title="Beauftragt" value={commissionedProjects} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#fbf9ff' }}>
            <Statistic title="Abgeschlossen" value={completedProjects} prefix={<StarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
        <Table
          columns={projectColumns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 5 }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedProject ? [selectedProject.id] : [],
            onChange: ([key]) => setSelectedProjectId(key)
          }}
          locale={{ emptyText: <Empty description="Noch keine Projekte angelegt." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      {selectedProject && (
        <Card
          bordered={false}
          title={<Space><ProjectOutlined />{selectedProject.title}</Space>}
          extra={<Tag color={statusLabels[selectedProject.status]?.color}>{statusLabels[selectedProject.status]?.label}</Tag>}
          style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
        >
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            {selectedProject.description && <Paragraph style={{ marginBottom: 0 }}>{selectedProject.description}</Paragraph>}

            <Table
              columns={offerColumns}
              dataSource={selectedProject.offers || []}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: <Empty description="Noch keine Angebote für dieses Projekt." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />

            {acceptedOffer && (
              <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
                <Descriptions.Item label="Angenommenes Angebot">{acceptedOffer.contractor?.companyName}</Descriptions.Item>
                <Descriptions.Item label="Angebotssumme">{euro.format(acceptedOffer.amount)}</Descriptions.Item>
                <Descriptions.Item label="Auftragsbestätigung">
                  {selectedProject.orderConfirmationFileName || 'Nicht hinterlegt'}
                </Descriptions.Item>
                <Descriptions.Item label="Finaler Vertrag">
                  {selectedProject.finalContractFileName || 'Nicht hinterlegt'}
                </Descriptions.Item>
              </Descriptions>
            )}

            {selectedProject.finalInvoiceAmount && (
              <Alert
                type={selectedProject.invoiceDeviationWarning ? 'warning' : 'success'}
                showIcon
                icon={selectedProject.invoiceDeviationWarning ? <WarningOutlined /> : <CheckCircleOutlined />}
                message={`Schlussrechnung: ${euro.format(selectedProject.finalInvoiceAmount)}`}
                description={`Abweichung: ${euro.format(selectedProject.invoiceDeviationEuro)} (${percent.format(deviation || 0)} %)`}
              />
            )}

            <Space wrap>
              <Button
                icon={<FilePdfOutlined />}
                disabled={!acceptedOffer}
                onClick={() => setInvoiceProject(selectedProject)}
              >
                Schlussrechnung
              </Button>
              <Button
                type="primary"
                icon={<StarOutlined />}
                disabled={!selectedProject.canReview}
                onClick={() => setReviewProject(selectedProject)}
              >
                Bewerten
              </Button>
            </Space>
          </Space>
        </Card>
      )}

      <Modal
        title="Projekt anlegen"
        open={projectModalOpen}
        onCancel={() => setProjectModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={projectForm} layout="vertical" onFinish={handleCreateProject}>
          <Form.Item name="title" label="Projekttitel" rules={[{ required: true, message: 'Projekttitel ist erforderlich' }]}>
            <Input placeholder="z.B. Bad sanieren" />
          </Form.Item>
          <Form.Item name="trade" label="Gewerk" rules={[{ required: true, message: 'Gewerk ist erforderlich' }]}>
            <Select
              showSearch
              placeholder="Bitte auswählen"
              options={TRADE_OPTIONS.map((trade) => ({ value: trade, label: trade }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Beschreibung">
            <Input.TextArea rows={3} placeholder="Umfang, Räume, Besonderheiten ..." />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setProjectModalOpen(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Angebot erfassen"
        open={Boolean(offerModalProject)}
        onCancel={() => setOfferModalProject(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={offerForm} layout="vertical" onFinish={handleCreateOffer}>
          <Form.Item name="contractorId" label="Handwerker" rules={[{ required: true, message: 'Handwerker ist erforderlich' }]}>
            <Select showSearch placeholder="Handwerker auswählen" optionFilterProp="children">
              {contractors.map((contractor) => (
                <Option key={contractor.id} value={contractor.id}>
                  {contractor.companyName} - {contractor.trade}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Angebotssumme" rules={[{ required: true, message: 'Angebotssumme ist erforderlich' }]}>
            <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pdf" label="Angebots-PDF" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload {...pdfUploadProps}>
              <Button icon={<UploadOutlined />}>PDF auswählen</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="notes" label="Notizen">
            <Input.TextArea rows={3} placeholder="Leistungsumfang, Varianten, offene Punkte ..." />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setOfferModalProject(null)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Angebot offiziell annehmen"
        open={Boolean(acceptingOffer)}
        onCancel={() => setAcceptingOffer(null)}
        footer={null}
        destroyOnClose
      >
        {acceptingOffer && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`${acceptingOffer.contractor?.companyName} wird beauftragt`}
            description="Alle anderen Angebote dieses Projekts werden automatisch abgelehnt."
          />
        )}
        <Form form={acceptForm} layout="vertical" onFinish={handleAcceptOffer}>
          <Form.Item name="orderConfirmationPdf" label="Auftragsbestätigung als PDF" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload {...pdfUploadProps}>
              <Button icon={<UploadOutlined />}>PDF auswählen</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="finalContractPdf" label="Finaler Vertrag als PDF" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload {...pdfUploadProps}>
              <Button icon={<UploadOutlined />}>PDF auswählen</Button>
            </Upload>
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAcceptingOffer(null)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Annehmen</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Schlussrechnung erfassen"
        open={Boolean(invoiceProject)}
        onCancel={() => setInvoiceProject(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={invoiceForm} layout="vertical" onFinish={handleFinalInvoice}>
          <Form.Item name="finalInvoiceAmount" label="Finale Rechnungssumme" rules={[{ required: true, message: 'Rechnungssumme ist erforderlich' }]}>
            <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="invoicePdf" label="Rechnungs-PDF" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload {...pdfUploadProps}>
              <Button icon={<UploadOutlined />}>PDF auswählen</Button>
            </Upload>
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setInvoiceProject(null)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Handwerker bewerten"
        open={Boolean(reviewProject)}
        onCancel={() => setReviewProject(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={reviewForm} layout="vertical" onFinish={handleReview}>
          <Form.Item name="priceFaithful" label="Preistreue" rules={[{ required: true, message: 'Bitte bewerten' }]}>
            <Rate />
          </Form.Item>
          <Form.Item name="punctuality" label="Pünktlichkeit" rules={[{ required: true, message: 'Bitte bewerten' }]}>
            <Rate />
          </Form.Item>
          <Form.Item name="speed" label="Geschwindigkeit" rules={[{ required: true, message: 'Bitte bewerten' }]}>
            <Rate />
          </Form.Item>
          <Form.Item name="quality" label="Qualität" rules={[{ required: true, message: 'Bitte bewerten' }]}>
            <Rate />
          </Form.Item>
          <Form.Item name="notes" label="Notizen">
            <Input.TextArea rows={3} placeholder="Kurzes Fazit zur Zusammenarbeit ..." />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setReviewProject(null)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Bewertung speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectTendering;
