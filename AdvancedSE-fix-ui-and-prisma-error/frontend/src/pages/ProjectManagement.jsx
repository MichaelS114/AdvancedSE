import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
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
  Typography
} from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { PROJECT_STATUSES, formatCurrency, formatDate, statusMeta } from '../utils/projectDisplay';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const API_URL = 'http://localhost:5001/api/projects';

const PROJECT_CATEGORIES = [
  'Sanierung',
  'Instandhaltung',
  'Umbau',
  'Energie',
  'Außenbereich',
  'Innenausbau',
  'Sonstiges'
];

const toDateInputValue = (value) => {
  if (!value) return undefined;
  return new Date(value).toISOString().slice(0, 10);
};

const ProjectManagement = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [statusFilter, setStatusFilter] = useState();

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, {
        headers: authHeaders,
        params: { status: statusFilter || undefined }
      });
      setProjects(res.data);
    } catch {
      message.error('Fehler beim Laden der Projekte');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message, statusFilter]);

  useEffect(() => {
    // Initial load synchronizes the screen with persisted project records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProjects();
  }, [fetchProjects]);

  const activeProjects = useMemo(() => {
    return projects.filter((project) => ['IN_PLANUNG', 'BEAUFTRAGT', 'IN_UMSETZUNG'].includes(project.status));
  }, [projects]);

  const totalActiveBudget = useMemo(() => {
    return activeProjects.reduce((sum, project) => sum + (Number(project.targetBudget) || 0), 0);
  }, [activeProjects]);

  const nextDeadline = useMemo(() => {
    return activeProjects
      .filter((project) => project.desiredDeadline)
      .map((project) => new Date(project.desiredDeadline))
      .sort((a, b) => a - b)[0];
  }, [activeProjects]);

  const handleOpenModal = (project = null) => {
    if (project) {
      setEditingProjectId(project.id);
      form.setFieldsValue({
        ...project,
        desiredStartDate: toDateInputValue(project.desiredStartDate),
        desiredDeadline: toDateInputValue(project.desiredDeadline)
      });
    } else {
      setEditingProjectId(null);
      form.resetFields();
      form.setFieldsValue({ status: 'IN_PLANUNG' });
    }
    setIsModalVisible(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editingProjectId) {
        await axios.put(`${API_URL}/${editingProjectId}`, values, { headers: authHeaders });
        message.success('Projekt aktualisiert');
      } else {
        await axios.post(API_URL, values, { headers: authHeaders });
        message.success('Projekt angelegt');
      }

      setIsModalVisible(false);
      await fetchProjects();
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern des Projekts');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`, { headers: authHeaders });
      message.success('Projekt gelöscht');
      await fetchProjects();
    } catch {
      message.error('Fehler beim Löschen des Projekts');
    }
  };

  const columns = [
    {
      title: 'Projekt',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{title}</Text>
          <Text type="secondary">{record.category}</Text>
          {record.documentReference && (
            <Paragraph ellipsis={{ rows: 1 }} style={{ marginBottom: 0, maxWidth: 360 }}>
              <FolderOpenOutlined /> {record.documentReference}
            </Paragraph>
          )}
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const meta = statusMeta[status] || { label: status, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    },
    {
      title: 'Zielbudget',
      dataIndex: 'targetBudget',
      key: 'targetBudget',
      align: 'right',
      render: (targetBudget) => <Text strong>{formatCurrency(targetBudget)}</Text>
    },
    {
      title: 'Wunsch-Zeitraum',
      key: 'dates',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{formatDate(record.desiredStartDate)}</Text>
          <Text type="secondary">bis {formatDate(record.desiredDeadline)}</Text>
        </Space>
      )
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Popconfirm
            title="Projekt löschen?"
            description="Dieses Projekt wird dauerhaft entfernt."
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
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Projektverwaltung</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Bau- und Instandhaltungsprojekte</Title>
          <Text type="secondary">Angebote, Fristen, Budgets und Dokumentbezüge als Projektcontainer verwalten.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Projekt anlegen
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#f8fbff' }}>
            <Statistic title="Projekte" value={projects.length} prefix={<ProjectOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#f9fdfb' }}>
            <Statistic title="Aktive Projekte" value={activeProjects.length} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#fffaf2' }}>
            <Statistic title="Aktives Zielbudget" value={totalActiveBudget} formatter={(value) => formatCurrency(value)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card bordered={false} style={{ background: '#fbfbff' }}>
            <Statistic title="Nächste Deadline" value={nextDeadline ? formatDate(nextDeadline) : 'Keine'} />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={8}>
            <Select
              allowClear
              placeholder="Status filtern"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
            >
              {PROJECT_STATUSES.map((status) => (
                <Option key={status.value} value={status.value}>{status.label}</Option>
              ))}
            </Select>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="Noch keine Projekte angelegt." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      <Modal
        title={editingProjectId ? 'Projekt bearbeiten' : 'Projekt anlegen'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label="Titel" rules={[{ required: true, message: 'Titel ist erforderlich' }]}>
            <Input placeholder="z.B. Bad sanieren" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="category" label="Kategorie" rules={[{ required: true, message: 'Kategorie ist erforderlich' }]}>
                <Select placeholder="Bitte auswählen">
                  {PROJECT_CATEGORIES.map((category) => (
                    <Option key={category} value={category}>{category}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="targetBudget" label="Zielbudget" rules={[{ required: true, message: 'Zielbudget ist erforderlich' }]}>
                <InputNumber style={{ width: '100%' }} min={0} addonAfter="EUR" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="desiredStartDate" label="Wunsch-Startdatum">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="desiredDeadline" label="Wunsch-Deadline">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Status ist erforderlich' }]}>
            <Select>
              {PROJECT_STATUSES.map((status) => (
                <Option key={status.value} value={status.value}>{status.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="documentReference" label="Dokumentbezug">
            <Input.TextArea rows={2} placeholder="z.B. Ordner, Aktenzeichen oder Link zu Angebotsunterlagen" />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Abbrechen</Button>
              <Button type="primary" htmlType="submit" loading={saving}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectManagement;
