import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Empty, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined, EyeOutlined, FileOutlined, FilePdfOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import FileUploadPanel from '../components/common/FileUploadPanel';
import { documentTypeLabel, formatDocumentDate, formatFileSize } from '../utils/documentDisplay';

const { Title, Text } = Typography;

const API_URL = 'http://localhost:5001/api/documents';

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const Documents = () => {
  const { token } = useAuth();
  const { message } = App.useApp();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [missingProperty, setMissingProperty] = useState(false);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL, { headers: authHeaders });
      setDocuments(res.data.documents || []);
      setMissingProperty(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setDocuments([]);
        setMissingProperty(true);
      } else {
        message.error('Dokumente konnten nicht geladen werden');
      }
    } finally {
      setLoading(false);
    }
  }, [authHeaders, message]);

  useEffect(() => {
    // Initial load keeps the document table in sync with persisted records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDocuments();
  }, [fetchDocuments]);

  const uploadFiles = async (files) => {
    const payloadFiles = await Promise.all(files.map(async (file) => ({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      dataUrl: await readFileAsDataUrl(file)
    })));

    try {
      await axios.post(API_URL, { files: payloadFiles }, { headers: authHeaders });
      message.success(payloadFiles.length === 1 ? 'Dokument gespeichert' : 'Dokumente gespeichert');
      await fetchDocuments();
    } catch (err) {
      message.error(err.response?.data?.error || 'Dokument konnte nicht gespeichert werden');
    }
  };

  const openBlobResponse = async (document, mode) => {
    try {
      const endpoint = mode === 'view' ? 'view' : 'download';
      const res = await axios.get(`${API_URL}/${document.id}/${endpoint}`, {
        headers: authHeaders,
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: document.mimeType });
      const url = URL.createObjectURL(blob);

      if (mode === 'view') {
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
        return;
      }

      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.response?.data?.error || 'Dokument konnte nicht geöffnet werden');
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      await axios.delete(`${API_URL}/${documentId}`, { headers: authHeaders });
      message.success('Dokument gelöscht');
      await fetchDocuments();
    } catch (err) {
      message.error(err.response?.data?.error || 'Dokument konnte nicht gelöscht werden');
    }
  };

  const columns = [
    {
      title: 'Dokument',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (fileName, record) => (
        <Space>
          {record.mimeType === 'application/pdf' ? <FilePdfOutlined /> : <FileOutlined />}
          <Space direction="vertical" size={0}>
            <Text strong>{record.title || fileName}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{fileName}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: 'Typ',
      dataIndex: 'mimeType',
      key: 'mimeType',
      render: (mimeType) => <Tag>{documentTypeLabel(mimeType)}</Tag>
    },
    {
      title: 'Größe',
      dataIndex: 'fileSize',
      key: 'fileSize',
      render: (fileSize) => formatFileSize(fileSize)
    },
    {
      title: 'Hochgeladen',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDocumentDate
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            disabled={record.mimeType !== 'application/pdf'}
            onClick={() => openBlobResponse(record, 'view')}
          />
          <Button type="text" icon={<DownloadOutlined />} onClick={() => openBlobResponse(record, 'download')} />
          <Popconfirm
            title="Dokument löschen?"
            description="Die Datei wird dauerhaft aus der Datenbank entfernt."
            okText="Löschen"
            cancelText="Abbrechen"
            onConfirm={() => deleteDocument(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Text type="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 12 }}>Dokumentenbasis</Text>
        <Title level={2} style={{ margin: '4px 0 0' }}>Dokumente</Title>
        <Text type="secondary">Gemeinsame Ablage für PDFs, Bilder und Office-Dateien in der Datenbank.</Text>
      </div>

      {missingProperty ? (
        <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
          <Empty description="Bitte zuerst ein Objekt anlegen, bevor Dokumente gespeichert werden." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <>
          <Card bordered={false} style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <FileUploadPanel title="Dokumente oder PDFs ablegen" onUpload={uploadFiles} />
          </Card>

          <Card bordered={false} title="Gespeicherte Dokumente" style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <Table
              columns={columns}
              dataSource={documents}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: <Empty description="Noch keine Dokumente gespeichert." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default Documents;
