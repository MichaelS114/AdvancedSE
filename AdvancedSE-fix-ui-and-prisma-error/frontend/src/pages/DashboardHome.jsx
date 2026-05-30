import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Col, Empty, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { CalendarOutlined, FileOutlined, FilePdfOutlined, FolderOpenOutlined, PlusOutlined, ProjectOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import FileUploadPanel from '../components/common/FileUploadPanel';
import { documentTypeLabel, formatDocumentDate, formatFileSize } from '../utils/documentDisplay';
import { formatCurrency, formatDate, statusMeta } from '../utils/projectDisplay';

const { Title, Text } = Typography;

const DashboardHome = ({ title }) => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { message } = App.useApp();
  const [activeProjects, setActiveProjects] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const isProfessionist = user?.role === 'PROFESSIONIST';

  const isPlaceholder = Boolean(title);
  const placeholderDueDates = [
    { title: 'Grundsteuer prüfen', due: 'Nächste Woche' },
    { title: 'Versicherungspolizze erneuern', due: 'In 30 Tagen' }
  ];
  const placeholderDocuments = [
    { title: 'Kaufvertrag', type: 'PDF' },
    { title: 'Energieausweis', type: 'PDF' }
  ];

  const fetchActiveProjects = useCallback(async () => {
    if (isPlaceholder || isProfessionist) return;

    setProjectsLoading(true);
    try {
      const res = await axios.get('http://localhost:5001/api/projects/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveProjects(res.data);
    } catch {
      message.error('Fehler beim Laden aktiver Projekte');
    } finally {
      setProjectsLoading(false);
    }
  }, [isPlaceholder, isProfessionist, message, token]);

  const fetchDocuments = useCallback(async () => {
    if (isPlaceholder || isProfessionist) return;

    setDocumentsLoading(true);
    try {
      const res = await axios.get('http://localhost:5001/api/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data.documents || []);
    } catch (err) {
      setDocuments([]);
      if (err.response?.status !== 404) {
        message.error('Fehler beim Laden der Dokumente');
      }
    } finally {
      setDocumentsLoading(false);
    }
  }, [isPlaceholder, isProfessionist, message, token]);

  useEffect(() => {
    // Initial load keeps the dashboard in sync with active project and document records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchActiveProjects();
    void fetchDocuments();
  }, [fetchActiveProjects, fetchDocuments]);

  const activeBudget = useMemo(() => {
    return activeProjects.reduce((sum, project) => sum + (Number(project.targetBudget) || 0), 0);
  }, [activeProjects]);

  const nextDeadline = useMemo(() => {
    return activeProjects
      .filter((project) => project.desiredDeadline)
      .map((project) => new Date(project.desiredDeadline))
      .sort((a, b) => a - b)[0];
  }, [activeProjects]);

  const documentOverview = useMemo(() => documents.slice(0, 4), [documents]);

  if (title === 'Dokumente') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Dokumentenbasis</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>{title}</Title>
          <Text type="secondary">Gemeinsamer Datei- und PDF-Upload für alle späteren Fachbereiche.</Text>
        </div>
        <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
          <FileUploadPanel title="Dokumente oder PDFs ablegen" />
        </Card>
      </div>
    );
  }

  if (isPlaceholder) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Arbeitsübersicht</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>{title}</Title>
          <Text type="secondary">Platzhalter für aktive Projekte, Fälligkeiten und Dokumente.</Text>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title="Aktive Projekte" bordered={false} style={{ height: '100%' }}>
              <Empty description="Noch keine verknüpften Projekte" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Fälligkeiten" bordered={false} style={{ height: '100%' }}>
              <List
                dataSource={placeholderDueDates}
                renderItem={(item) => (
                  <List.Item>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Text>{item.title}</Text>
                      <Text type="secondary">{item.due}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Dokumente" bordered={false} style={{ height: '100%' }}>
              <List
                dataSource={placeholderDocuments}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <FolderOpenOutlined />
                      <Text>{item.title}</Text>
                      <Tag>{item.type}</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  if (isProfessionist) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Dashboard</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Professionistenbereich</Title>
          <Text type="secondary">Passende Projekte finden, Angebote stellen und Ihr Firmenprofil aktuell halten.</Text>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
              <Statistic title="Nächster Schritt" value="Projekte prüfen" />
              <Button type="primary" icon={<ProjectOutlined />} style={{ marginTop: 16 }} onClick={() => navigate('/offers')}>
                Zu passenden Projekten
              </Button>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
              <Statistic title="Profil" value="Firmenprofil" />
              <Button icon={<FolderOpenOutlined />} style={{ marginTop: 16 }} onClick={() => navigate('/contractors')}>
                Profil bearbeiten
              </Button>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Dashboard</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Aktive Projekte im Blick</Title>
          <Text type="secondary">Laufende Bau- und Instandhaltungsprojekte mit Budget und Fristen.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/projects')}>
          Projekt anlegen
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#f8fbff' }}>
            <Statistic title="Aktive Projekte" value={activeProjects.length} prefix={<ProjectOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#fffaf2' }}>
            <Statistic title="Aktives Zielbudget" value={activeBudget} formatter={(value) => formatCurrency(value)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={{ background: '#fbfbff' }}>
            <Statistic title="Nächste Deadline" value={nextDeadline ? formatDate(nextDeadline) : 'Keine'} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Aktive Projektliste"
        bordered={false}
        style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
        extra={<Button icon={<FolderOpenOutlined />} onClick={() => navigate('/projects')}>Alle Projekte</Button>}
      >
        <List
          loading={projectsLoading}
          dataSource={activeProjects}
          locale={{ emptyText: <Empty description="Keine aktiven Projekte vorhanden." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          renderItem={(project) => {
            const meta = statusMeta[project.status] || { label: project.status, color: 'default' };
            return (
              <List.Item
                actions={[
                  <Button key="open" type="link" onClick={() => navigate('/projects')}>Öffnen</Button>
                ]}
              >
                <List.Item.Meta
                  title={(
                    <Space wrap>
                      <Text strong>{project.title}</Text>
                      <Tag color={meta.color}>{meta.label}</Tag>
                    </Space>
                  )}
                  description={(
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{project.category} · {formatCurrency(project.targetBudget)}</Text>
                      <Text type="secondary">Start {formatDate(project.desiredStartDate)} · Deadline {formatDate(project.desiredDeadline)}</Text>
                    </Space>
                  )}
                />
              </List.Item>
            );
          }}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Fälligkeiten" bordered={false} style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <List
              dataSource={activeProjects.filter((project) => project.desiredDeadline).slice(0, 4)}
              locale={{ emptyText: <Empty description="Keine Fälligkeiten vorhanden." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              renderItem={(project) => (
                <List.Item>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text>{project.title}</Text>
                    <Text type="secondary">{formatDate(project.desiredDeadline)}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Dokumente" bordered={false} style={{ height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <List
              loading={documentsLoading}
              dataSource={documentOverview}
              locale={{ emptyText: <Empty description="Noch keine Dokumente gespeichert." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              renderItem={(document) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={document.mimeType === 'application/pdf' ? <FilePdfOutlined /> : <FileOutlined />}
                    title={(
                      <Space wrap>
                        <Text strong>{document.title || document.fileName}</Text>
                        <Tag>{documentTypeLabel(document.mimeType)}</Tag>
                      </Space>
                    )}
                    description={(
                      <Text type="secondary">
                        {formatFileSize(document.fileSize)} · {formatDocumentDate(document.createdAt)}
                      </Text>
                    )}
                  />
                </List.Item>
              )}
            />
            <Button
              type="link"
              icon={<FolderOpenOutlined />}
              style={{ paddingInline: 0, marginTop: 8 }}
              onClick={() => navigate('/documents')}
            >
              Alle Dokumente
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardHome;
