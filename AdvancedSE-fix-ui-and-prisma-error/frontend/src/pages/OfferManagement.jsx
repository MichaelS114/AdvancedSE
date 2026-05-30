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
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FilePdfOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  SyncOutlined,
  TrophyOutlined,
  UploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const { Text, Title } = Typography;

const PROJECTS_API = 'http://localhost:5001/api/projects';
const OFFERS_API = 'http://localhost:5001/api/offers';
const NEGOTIATIONS_API = 'http://localhost:5001/api/negotiations';
const CHATS_API = 'http://localhost:5001/api/chats';

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
  const { token, user } = useAuth();
  const { message } = App.useApp();
  const [offerForm] = Form.useForm();
  const [negotiationForm] = Form.useForm();
  const [projects, setProjects] = useState([]);
  const [offers, setOffers] = useState([]);
  const [negotiations, setNegotiations] = useState([]);
  const [chatThreads, setChatThreads] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [negotiationSaving, setNegotiationSaving] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [negotiationModalOpen, setNegotiationModalOpen] = useState(false);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [negotiationOffer, setNegotiationOffer] = useState(null);
  const [negotiationSession, setNegotiationSession] = useState(null);
  const [chatOffer, setChatOffer] = useState(null);
  const [activeChatThread, setActiveChatThread] = useState(null);
  const [chatDraft, setChatDraft] = useState('');
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfMeta, setPdfMeta] = useState(null);

  const isProfessionist = user?.role === 'PROFESSIONIST';
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId]
  );

  const selectedOffers = useMemo(
    () => offers.filter((offer) => offer.projectId === selectedProject?.id),
    [offers, selectedProject]
  );

  const negotiationsByOfferId = useMemo(() => {
    return negotiations.reduce((map, negotiation) => {
      map[negotiation.offerId] = negotiation;
      return map;
    }, {});
  }, [negotiations]);

  const chatThreadsByOfferId = useMemo(() => {
    return chatThreads.reduce((map, thread) => {
      map[thread.offerId] = thread;
      return map;
    }, {});
  }, [chatThreads]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const projectUrl = isProfessionist ? `${PROJECTS_API}/available` : PROJECTS_API;
      const [projectsRes, offersRes, negotiationsRes, chatsRes] = await Promise.all([
        axios.get(projectUrl, { headers: authHeaders }),
        axios.get(OFFERS_API, { headers: authHeaders }),
        axios.get(NEGOTIATIONS_API, { headers: authHeaders }),
        axios.get(CHATS_API, { headers: authHeaders })
      ]);
      setProjects(projectsRes.data);
      setOffers(offersRes.data);
      setNegotiations(negotiationsRes.data);
      setChatThreads(chatsRes.data);
      setSelectedProjectId((current) => {
        if (current && projectsRes.data.some((project) => project.id === current)) return current;
        return projectsRes.data[0]?.id || null;
      });
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Laden der Angebotsdaten');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, isProfessionist, message]);

  useEffect(() => {
    // Initial load synchronizes the offer workspace with persisted records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const openOfferModal = (project, offer = null) => {
    setEditingOfferId(offer?.id || null);
    setPdfPreview(offer?.pdfDataUrl || null);
    setPdfMeta(offer?.pdfFileName ? { fileName: offer.pdfFileName, mimeType: offer.pdfMimeType } : null);
    offerForm.resetFields();
    offerForm.setFieldsValue({
      projectId: project.id,
      price: offer?.amount,
      validUntil: toDateInput(offer?.validUntil),
      scopeDescription: offer?.scopeDescription,
      availabilityStart: toDateInput(offer?.availabilityStart),
      durationDays: offer?.durationDays,
      includedServices: offer ? getServiceDescriptions(offer, 'INCLUDED') : [''],
      excludedServices: offer ? getServiceDescriptions(offer, 'EXCLUDED') : [''],
      notes: offer?.notes
    });
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
        await axios.put(`${OFFERS_API}/${editingOfferId}`, payload, { headers: authHeaders });
        message.success('Angebot aktualisiert');
      } else {
        await axios.post(OFFERS_API, payload, { headers: authHeaders });
        message.success('Angebot abgegeben');
      }
      setOfferModalOpen(false);
      await fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern des Angebots');
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

  const ownOfferForProject = (projectId) => offers.find((offer) => offer.projectId === projectId);

  const refreshNegotiation = async (sessionId) => {
    if (!sessionId) return null;
    const res = await axios.get(`${NEGOTIATIONS_API}/${sessionId}`, { headers: authHeaders });
    setNegotiationSession(res.data);
    setNegotiations((current) => {
      const others = current.filter((item) => item.id !== res.data.id);
      return [res.data, ...others];
    });
    return res.data;
  };

  const openNegotiationModal = async (offer) => {
    setNegotiationOffer(offer);
    setNegotiationModalOpen(true);
    setNegotiationLoading(true);
    negotiationForm.resetFields();

    try {
      const res = await axios.get(`${NEGOTIATIONS_API}?offerId=${offer.id}`, { headers: authHeaders });
      const session = res.data[0] || negotiationsByOfferId[offer.id] || null;
      setNegotiationSession(session);
      negotiationForm.setFieldsValue({
        customerTargetPrice: session?.customerTargetPrice || Math.round((offer.amount || 0) * 0.85),
        customerMaxPrice: session?.customerMaxPrice || Math.round((offer.amount || 0) * 0.95),
        contractorTargetPrice: session?.contractorTargetPrice || offer.amount,
        contractorMinPrice: session?.contractorMinPrice || Math.round((offer.amount || 0) * 0.9)
      });
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Laden der Verhandlung');
    } finally {
      setNegotiationLoading(false);
    }
  };

  const saveNegotiationLimits = async (values) => {
    if (!negotiationOffer) return;
    setNegotiationSaving(true);
    try {
      const endpoint = isProfessionist ? 'contractor-limits' : 'customer-limits';
      const res = await axios.post(
        `${NEGOTIATIONS_API}/offers/${negotiationOffer.id}/${endpoint}`,
        values,
        { headers: authHeaders }
      );
      setNegotiationSession(res.data);
      setNegotiations((current) => [res.data, ...current.filter((item) => item.id !== res.data.id)]);
      message.success('Preisgrenzen gespeichert');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Speichern der Preisgrenzen');
    } finally {
      setNegotiationSaving(false);
    }
  };

  const runNegotiationStep = async () => {
    if (!negotiationSession) return;
    setNegotiationSaving(true);
    try {
      const res = await axios.post(`${NEGOTIATIONS_API}/${negotiationSession.id}/step`, {}, { headers: authHeaders });
      setNegotiationSession(res.data);
      setNegotiations((current) => [res.data, ...current.filter((item) => item.id !== res.data.id)]);
      if (res.data.status === 'DEAL_PROPOSED') {
        message.success('Deal-Vorschlag gefunden');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Ausfuehren der Verhandlungsrunde');
    } finally {
      setNegotiationSaving(false);
    }
  };

  const confirmNegotiation = async () => {
    if (!negotiationSession) return;
    setNegotiationSaving(true);
    try {
      const res = await axios.post(`${NEGOTIATIONS_API}/${negotiationSession.id}/confirm`, {}, { headers: authHeaders });
      setNegotiationSession(res.data);
      setNegotiations((current) => [res.data, ...current.filter((item) => item.id !== res.data.id)]);
      await fetchData();
      if (res.data.status === 'CONFIRMED') {
        message.success('Deal bestaetigt und Angebotspreis aktualisiert');
      } else {
        message.success('Ihre Bestaetigung wurde gespeichert');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Bestaetigen der Verhandlung');
    } finally {
      setNegotiationSaving(false);
      if (negotiationSession?.id) void refreshNegotiation(negotiationSession.id);
    }
  };

  const cancelNegotiation = async () => {
    if (!negotiationSession) return;
    setNegotiationSaving(true);
    try {
      const res = await axios.post(`${NEGOTIATIONS_API}/${negotiationSession.id}/cancel`, {}, { headers: authHeaders });
      setNegotiationSession(res.data);
      setNegotiations((current) => [res.data, ...current.filter((item) => item.id !== res.data.id)]);
      message.success('Verhandlung abgebrochen');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Abbrechen der Verhandlung');
    } finally {
      setNegotiationSaving(false);
    }
  };

  const openChatModal = async (offer) => {
    setChatOffer(offer);
    setChatModalOpen(true);
    setChatLoading(true);
    setChatDraft('');

    try {
      const res = await axios.get(`${CHATS_API}?offerId=${offer.id}`, { headers: authHeaders });
      const thread = res.data[0] || chatThreadsByOfferId[offer.id] || null;
      setActiveChatThread(thread);
      if (thread) {
        setChatThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Laden des Chats');
    } finally {
      setChatLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatOffer || !chatDraft.trim()) return;
    setChatSending(true);

    try {
      const res = await axios.post(
        `${CHATS_API}/offers/${chatOffer.id}/messages`,
        { body: chatDraft },
        { headers: authHeaders }
      );
      setActiveChatThread(res.data);
      setChatThreads((current) => [res.data, ...current.filter((item) => item.id !== res.data.id)]);
      setChatDraft('');
    } catch (err) {
      message.error(err.response?.data?.error || 'Fehler beim Senden der Nachricht');
    } finally {
      setChatSending(false);
    }
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

  const winnerTag = (label) => (
    <Tag color="green" icon={<TrophyOutlined />} style={{ marginLeft: 8 }}>{label}</Tag>
  );

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
    { title: 'Status', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
    {
      title: 'PDF',
      render: (_, record) => record.pdfDataUrl ? <Tag icon={<FilePdfOutlined />} color="red">PDF</Tag> : <Tag>Kein PDF</Tag>
    },
    {
      title: '',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button
            icon={<MessageOutlined />}
            onClick={() => openChatModal(record)}
          >
            Chat
          </Button>
          <Button
            icon={<RobotOutlined />}
            disabled={record.status !== 'PENDING' && !negotiationsByOfferId[record.id]}
            onClick={() => openNegotiationModal(record)}
          >
            KI-Verhandlung
          </Button>
          {isProfessionist ? (
            <Button
              type="text"
              icon={<EditOutlined />}
              disabled={record.status !== 'PENDING'}
              onClick={() => openOfferModal(record.project, record)}
            />
          ) : null}
        </Space>
      )
    }
  ];

  const projectColumns = [
    {
      title: 'Projekt',
      dataIndex: 'title',
      render: (title, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary">{record.trade || record.category}</Text>
        </Space>
      )
    },
    { title: 'Budget', dataIndex: 'targetBudget', render: (value) => currency.format(value || 0) },
    { title: 'Wunschstart', dataIndex: 'desiredStartDate', render: formatDate },
    { title: 'Deadline', dataIndex: 'desiredDeadline', render: formatDate },
    {
      title: 'Mein Angebot',
      render: (_, record) => {
        const offer = ownOfferForProject(record.id);
        if (!offer) return <Tag>Offen</Tag>;
        return <Tag color={offer.status === 'ACCEPTED' ? 'green' : 'blue'}>{currency.format(offer.amount)}</Tag>;
      }
    },
    {
      title: '',
      align: 'right',
      render: (_, record) => {
        const offer = ownOfferForProject(record.id);
        return (
          <Button
            type={offer ? 'default' : 'primary'}
            icon={offer ? <EditOutlined /> : <PlusOutlined />}
            disabled={offer?.status && offer.status !== 'PENDING'}
            onClick={() => openOfferModal(record, offer)}
          >
            {offer ? 'Bearbeiten' : 'Angebot stellen'}
          </Button>
        );
      }
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
    { key: 'scope', label: 'Leistungsumfang', render: (offer) => <Text>{offer.scopeDescription}</Text> },
    {
      key: 'included',
      label: 'Inklusivleistungen',
      render: (offer) => (
        <Space wrap>{getServiceDescriptions(offer, 'INCLUDED').map((item) => <Tag color="blue" key={item}>{item}</Tag>)}</Space>
      )
    },
    {
      key: 'excluded',
      label: 'Exklusivleistungen',
      render: (offer) => (
        <Space wrap>{getServiceDescriptions(offer, 'EXCLUDED').map((item) => <Tag key={item}>{item}</Tag>)}</Space>
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
      render: (offer) => <Text>{offer.durationDays} Tage{winnerIds.shortest === offer.id ? winnerTag('kürzeste Dauer') : null}</Text>
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
                <Button danger type="text" onClick={() => remove(field.name)}>Entfernen</Button>
              </Space>
            ))}
            <Button icon={<PlusOutlined />} onClick={() => add('')}>Leistung hinzufügen</Button>
          </Space>
        </Form.Item>
      )}
    </Form.List>
  );

  const negotiationStatusLabel = {
    DRAFT: { label: 'Vorbereitet', color: 'default' },
    RUNNING: { label: 'Laeuft', color: 'blue' },
    DEAL_PROPOSED: { label: 'Deal-Vorschlag', color: 'gold' },
    CONFIRMED: { label: 'Bestaetigt', color: 'green' },
    FAILED: { label: 'Ohne Einigung', color: 'red' },
    CANCELLED: { label: 'Abgebrochen', color: 'red' }
  };

  const renderNegotiationForm = () => (
    <Form form={negotiationForm} layout="vertical" onFinish={saveNegotiationLimits}>
      {isProfessionist ? (
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="contractorTargetPrice" label="Zielpreis" rules={[{ required: true, message: 'Zielpreis ist erforderlich' }]}>
              <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contractorMinPrice" label="Mindestpreis" rules={[{ required: true, message: 'Mindestpreis ist erforderlich' }]}>
              <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      ) : (
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="customerTargetPrice" label="Zielpreis" rules={[{ required: true, message: 'Zielpreis ist erforderlich' }]}>
              <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="customerMaxPrice" label="Maximalpreis" rules={[{ required: true, message: 'Maximalpreis ist erforderlich' }]}>
              <InputNumber min={0} precision={2} addonAfter="EUR" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      )}
      <Button type="primary" htmlType="submit" loading={negotiationSaving}>
        Preisgrenzen speichern
      </Button>
    </Form>
  );

  const renderNegotiationMessages = () => {
    if (!negotiationSession?.messages?.length) {
      return <Empty description="Noch kein Verhandlungsverlauf." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {negotiationSession.messages.map((item) => (
          <Card
            key={item.id}
            size="small"
            bordered
            style={{
              background: item.role === 'SYSTEM' ? '#fafafa' : '#ffffff',
              borderColor: item.role === 'CUSTOMER_AGENT' ? '#91caff' : item.role === 'CONTRACTOR_AGENT' ? '#95de64' : '#d9d9d9'
            }}
          >
            <Space direction="vertical" size={2}>
              <Space wrap>
                <Tag color={item.role === 'CUSTOMER_AGENT' ? 'blue' : item.role === 'CONTRACTOR_AGENT' ? 'green' : 'default'}>
                  {item.role === 'CUSTOMER_AGENT' ? 'Kundenagent' : item.role === 'CONTRACTOR_AGENT' ? 'Professionistenagent' : 'System'}
                </Tag>
                {item.priceProposal !== null ? <Text strong>{currency.format(item.priceProposal)}</Text> : null}
                {item.round ? <Text type="secondary">Runde {item.round}</Text> : null}
              </Space>
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                {item.text}
              </Typography.Paragraph>
            </Space>
          </Card>
        ))}
      </Space>
    );
  };

  const renderChatMessages = () => {
    if (chatLoading) return <Card loading size="small" />;
    if (!activeChatThread?.messages?.length) {
      return <Empty description="Noch keine Nachrichten." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activeChatThread.messages.map((item) => {
          const isOwn = item.senderId === user?.id;
          const senderName = `${item.sender?.firstName || ''} ${item.sender?.lastName || ''}`.trim() || (item.sender?.role === 'PROFESSIONIST' ? 'Professionist' : 'Kunde');

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  maxWidth: '72%',
                  background: isOwn ? '#e6f4ff' : '#f5f5f5',
                  border: '1px solid #d9d9d9',
                  borderRadius: 8,
                  padding: '8px 10px'
                }}
              >
                <Space direction="vertical" size={2}>
                  <Text strong style={{ fontSize: 12 }}>{isOwn ? 'Sie' : senderName}</Text>
                  <Text>{item.body}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(item.createdAt)}</Text>
                </Space>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderProfessionalView = () => (
    <>
      <div>
        <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Professionistenbereich</Text>
        <Title level={2} style={{ margin: '4px 0 0' }}>Passende Projekte</Title>
        <Text type="secondary">Sie sehen nur offene Projekte, die exakt zu Ihrem hinterlegten Gewerk passen.</Text>
      </div>

      <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
        <Table
          columns={projectColumns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions size="small" column={{ xs: 1, md: 3 }}>
                <Descriptions.Item label="Kategorie">{record.category}</Descriptions.Item>
                <Descriptions.Item label="Gewerk">{record.trade}</Descriptions.Item>
                <Descriptions.Item label="Beschreibung">{record.description || 'Keine Beschreibung'}</Descriptions.Item>
              </Descriptions>
            )
          }}
          locale={{ emptyText: <Empty description="Keine passenden offenen Projekte gefunden." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
        <Title level={4}>Meine Angebote</Title>
        <Table
          columns={offerColumns}
          dataSource={offers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: <Empty description="Noch keine Angebote abgegeben." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>
    </>
  );

  const renderHomeownerView = () => (
    <>
      <div>
        <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Angebotsmanagement</Text>
        <Title level={2} style={{ margin: '4px 0 0' }}>Angebote vergleichen</Title>
        <Text type="secondary">Angebote werden von Professionisten gestellt und können hier projektweise verglichen werden.</Text>
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
                  locale={{ emptyText: <Empty description="Noch keine Angebote eingegangen." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
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
                        value={selectedProject?.id}
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
                          <Descriptions.Item label="Gewerk">{selectedProject.trade || '-'}</Descriptions.Item>
                          <Descriptions.Item label="Wunschstart">{formatDate(selectedProject.desiredStartDate)}</Descriptions.Item>
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
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {isProfessionist ? renderProfessionalView() : renderHomeownerView()}

      <Modal
        title={editingOfferId ? 'Angebot bearbeiten' : 'Angebot stellen'}
        open={offerModalOpen}
        onCancel={() => setOfferModalOpen(false)}
        footer={null}
        width={920}
        destroyOnClose
      >
        <Form form={offerForm} layout="vertical" onFinish={saveOffer}>
          <Form.Item name="projectId" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
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
              <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>Speichern</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="KI-Preisverhandlung"
        open={negotiationModalOpen}
        onCancel={() => setNegotiationModalOpen(false)}
        footer={null}
        width={1040}
        destroyOnClose
      >
        {negotiationOffer ? (
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Descriptions size="small" column={{ xs: 1, md: 3 }} bordered>
              <Descriptions.Item label="Projekt">{negotiationOffer.project?.title}</Descriptions.Item>
              <Descriptions.Item label="Firma">{negotiationOffer.contractor?.companyName}</Descriptions.Item>
              <Descriptions.Item label="Aktueller Preis">{currency.format(negotiationOffer.amount || 0)}</Descriptions.Item>
              <Descriptions.Item label="Status">
                {negotiationSession ? (
                  <Tag color={negotiationStatusLabel[negotiationSession.status]?.color}>
                    {negotiationStatusLabel[negotiationSession.status]?.label || negotiationSession.status}
                  </Tag>
                ) : (
                  <Tag>Keine Session</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Kunde bestaetigt">
                {negotiationSession?.customerConfirmedAt ? <Tag color="green">Ja</Tag> : <Tag>Nein</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Professionist bestaetigt">
                {negotiationSession?.contractorConfirmedAt ? <Tag color="green">Ja</Tag> : <Tag>Nein</Tag>}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered>
              <Descriptions.Item label="Leistungsumfang" span={2}>
                {negotiationOffer.scopeDescription || negotiationOffer.project?.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Inklusivleistungen">
                <Space wrap>
                  {getServiceDescriptions(negotiationOffer, 'INCLUDED').length
                    ? getServiceDescriptions(negotiationOffer, 'INCLUDED').map((item) => <Tag color="blue" key={item}>{item}</Tag>)
                    : <Text type="secondary">Keine Details</Text>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Ausschluesse">
                <Space wrap>
                  {getServiceDescriptions(negotiationOffer, 'EXCLUDED').length
                    ? getServiceDescriptions(negotiationOffer, 'EXCLUDED').map((item) => <Tag key={item}>{item}</Tag>)
                    : <Text type="secondary">Keine Details</Text>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Start">{formatDate(negotiationOffer.availabilityStart)}</Descriptions.Item>
              <Descriptions.Item label="Dauer">{negotiationOffer.durationDays ? `${negotiationOffer.durationDays} Tage` : '-'}</Descriptions.Item>
              <Descriptions.Item label="Wunschstart">{formatDate(negotiationOffer.project?.desiredStartDate)}</Descriptions.Item>
              <Descriptions.Item label="Deadline">{formatDate(negotiationOffer.project?.desiredDeadline)}</Descriptions.Item>
            </Descriptions>

            {negotiationSession?.finalProposalAmount ? (
              <Alert
                type={negotiationSession.status === 'CONFIRMED' ? 'success' : 'warning'}
                showIcon
                message={`Deal-Vorschlag: ${currency.format(negotiationSession.finalProposalAmount)}`}
                description="Der Angebotspreis wird erst aktualisiert, sobald beide Seiten bestaetigt haben."
              />
            ) : null}

            <Card size="small" title={isProfessionist ? 'Professionistenagent' : 'Kundenagent'} loading={negotiationLoading}>
              {renderNegotiationForm()}
            </Card>

            <Card
              size="small"
              title="Verhandlungsverlauf und Begruendung"
              extra={negotiationSession ? (
                <Space>
                  <Button
                    icon={<SyncOutlined />}
                    loading={negotiationSaving}
                    disabled={!['DRAFT', 'RUNNING'].includes(negotiationSession.status)}
                    onClick={runNegotiationStep}
                  >
                    Naechste KI-Runde
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={negotiationSaving}
                    disabled={negotiationSession.status !== 'DEAL_PROPOSED'}
                    onClick={confirmNegotiation}
                  >
                    Deal bestaetigen
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={negotiationSaving}
                    disabled={['CONFIRMED', 'CANCELLED'].includes(negotiationSession.status)}
                    onClick={cancelNegotiation}
                  >
                    Abbrechen
                  </Button>
                </Space>
              ) : null}
              bodyStyle={{ maxHeight: 520, overflowY: 'auto' }}
            >
              {renderNegotiationMessages()}
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title="Chat"
        open={chatModalOpen}
        onCancel={() => setChatModalOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        {chatOffer ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={{ xs: 1, md: 3 }} bordered>
              <Descriptions.Item label="Projekt">{chatOffer.project?.title}</Descriptions.Item>
              <Descriptions.Item label="Firma">{chatOffer.contractor?.companyName}</Descriptions.Item>
              <Descriptions.Item label="Angebot">{currency.format(chatOffer.amount || 0)}</Descriptions.Item>
            </Descriptions>

            <Card
              size="small"
              bodyStyle={{
                maxHeight: 420,
                overflowY: 'auto',
                background: '#ffffff'
              }}
            >
              {renderChatMessages()}
            </Card>

            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void sendChatMessage();
                  }
                }}
                autoSize={{ minRows: 2, maxRows: 5 }}
                maxLength={2000}
                placeholder="Nachricht schreiben ..."
                disabled={chatSending}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={chatSending}
                disabled={!chatDraft.trim()}
                onClick={sendChatMessage}
              >
                Senden
              </Button>
            </Space.Compact>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
};

export default OfferManagement;
