import { useState } from 'react';
import { DeleteOutlined, FileOutlined, FilePdfOutlined, InboxOutlined } from '@ant-design/icons';
import { App, Button, List, Space, Typography, Upload } from 'antd';

const { Dragger } = Upload;
const { Text } = Typography;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

const formatFileSize = (size) => {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isAcceptedFile = (file) => {
  if (file.type?.startsWith('image/')) return true;
  if (file.type === 'application/pdf') return true;

  const lowerName = file.name.toLowerCase();
  return allowedExtensions.some((extension) => lowerName.endsWith(extension));
};

const FileUploadPanel = ({
  title = 'Dateien hochladen',
  value = [],
  onChange,
  onUpload,
  maxFileSize = MAX_FILE_SIZE
}) => {
  const { message } = App.useApp();
  const [files, setFiles] = useState(value);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  const updateFiles = (nextFiles) => {
    setFiles(nextFiles);
    onChange?.(nextFiles);
  };

  const handleUpload = async (file) => {
    if (!isAcceptedFile(file)) {
      message.error('Dieser Dateityp wird nicht unterstützt');
      return Upload.LIST_IGNORE;
    }

    if (file.size > maxFileSize) {
      message.error('Dateien dürfen maximal 10 MB groß sein');
      return Upload.LIST_IGNORE;
    }

    if (onUpload) {
      setUploadingFiles((current) => [...current, file]);
      try {
        await onUpload([file]);
      } finally {
        setUploadingFiles((current) => current.filter((item) => item.uid !== file.uid));
      }
      return Upload.LIST_IGNORE;
    }

    updateFiles([...files, file]);
    return false;
  };

  return (
    <div>
      <Dragger
        multiple
        accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
        beforeUpload={handleUpload}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{title}</p>
        <p className="ant-upload-hint">PDFs, Bilder und Office-Dateien bis 10 MB können hier abgelegt werden.</p>
      </Dragger>

      {uploadingFiles.length > 0 ? (
        <List
          style={{ marginTop: 16 }}
          dataSource={uploadingFiles}
          renderItem={(file) => (
            <List.Item>
              <Space>
                {file.type === 'application/pdf' ? <FilePdfOutlined /> : <FileOutlined />}
                <span>{file.name}</span>
                <Text type="secondary">Wird hochgeladen...</Text>
              </Space>
            </List.Item>
          )}
        />
      ) : null}

      {!onUpload && files.length > 0 ? (
        <List
          style={{ marginTop: 16 }}
          dataSource={files}
          renderItem={(file) => (
            <List.Item
              actions={[
                <Button
                  key="remove"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => updateFiles(files.filter((item) => item.uid !== file.uid))}
                />
              ]}
            >
              <Space>
                {file.type === 'application/pdf' ? <FilePdfOutlined /> : <FileOutlined />}
                <span>{file.name}</span>
                <Text type="secondary">{formatFileSize(file.size)}</Text>
              </Space>
            </List.Item>
          )}
        />
      ) : null}
    </div>
  );
};

export default FileUploadPanel;
