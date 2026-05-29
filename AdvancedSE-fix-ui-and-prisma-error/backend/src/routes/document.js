const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const GENERAL_DOCUMENT_SOURCE = 'GENERAL_DOCUMENT';
const GENERAL_DOCUMENT_TYPE = 'ALLGEMEINES_DOKUMENT';

const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const documentSummary = {
  id: true,
  fileName: true,
  mimeType: true,
  documentType: true,
  title: true,
  fileSize: true,
  sourceType: true,
  sourceId: true,
  createdAt: true,
  updatedAt: true
};

const getOwnedProperty = (userId) => prisma.property.findUnique({ where: { userId } });

const getExtension = (fileName = '') => {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : '';
};

const parseDataUrl = (dataUrl) => {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl || '');
  if (!match) return null;

  return {
    mimeType: match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64')
  };
};

const validateFile = (file) => {
  if (!file?.fileName || !file.dataUrl) return 'Dateiname und Dateiinhalt sind erforderlich';

  const parsed = parseDataUrl(file.dataUrl);
  if (!parsed) return 'Datei konnte nicht gelesen werden';

  const mimeType = file.mimeType || parsed.mimeType;
  const extension = getExtension(file.fileName);
  if (!allowedMimeTypes.has(mimeType) && !allowedExtensions.has(extension)) {
    return 'Dateityp wird nicht unterstützt';
  }

  const fileSize = Number(file.fileSize) || parsed.buffer.length;
  if (fileSize > MAX_FILE_SIZE || parsed.buffer.length > MAX_FILE_SIZE) {
    return 'Datei darf maximal 10 MB groß sein';
  }

  return null;
};

const normalizeFile = (propertyId, file) => {
  const parsed = parseDataUrl(file.dataUrl);

  return {
    propertyId,
    fileName: file.fileName,
    mimeType: file.mimeType || parsed.mimeType,
    dataUrl: file.dataUrl,
    documentType: file.documentType || GENERAL_DOCUMENT_TYPE,
    title: file.title || file.fileName,
    fileSize: Number(file.fileSize) || parsed.buffer.length,
    sourceType: GENERAL_DOCUMENT_SOURCE
  };
};

const findDocumentForUser = (documentId, userId) => prisma.document.findFirst({
  where: {
    id: documentId,
    property: { userId }
  }
});

const findGeneralDocumentForUser = (documentId, userId) => prisma.document.findFirst({
  where: {
    id: documentId,
    sourceType: GENERAL_DOCUMENT_SOURCE,
    property: { userId }
  }
});

const sendDocument = (res, document, disposition) => {
  const parsed = parseDataUrl(document.dataUrl);
  if (!parsed) return res.status(422).json({ error: 'Dokumentinhalt ist ungültig' });

  res.setHeader('Content-Type', document.mimeType || parsed.mimeType);
  res.setHeader('Content-Length', parsed.buffer.length);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(document.fileName)}"`);
  return res.send(parsed.buffer);
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Bitte zuerst ein Objekt anlegen' });

    const documents = await prisma.document.findMany({
      where: {
        propertyId: property.id,
        sourceType: GENERAL_DOCUMENT_SOURCE
      },
      select: documentSummary,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ documents, maxFileSize: MAX_FILE_SIZE });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Dokumente' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Bitte zuerst ein Objekt anlegen' });

    const files = Array.isArray(req.body.files) ? req.body.files : [req.body.file].filter(Boolean);
    if (files.length === 0) return res.status(400).json({ error: 'Keine Dateien übermittelt' });

    const validationError = files.map(validateFile).find(Boolean);
    if (validationError) return res.status(400).json({ error: validationError });

    const documents = await prisma.$transaction(
      files.map((file) => prisma.document.create({
        data: normalizeFile(property.id, file),
        select: documentSummary
      }))
    );

    res.status(201).json({ documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Dokumente' });
  }
});

router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const document = await findDocumentForUser(req.params.id, req.user.id);
    if (!document) return res.status(404).json({ error: 'Dokument nicht gefunden' });

    return sendDocument(res, document, 'attachment');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen des Dokuments' });
  }
});

router.get('/:id/view', authenticateToken, async (req, res) => {
  try {
    const document = await findDocumentForUser(req.params.id, req.user.id);
    if (!document) return res.status(404).json({ error: 'Dokument nicht gefunden' });
    if (document.mimeType !== 'application/pdf') {
      return res.status(415).json({ error: 'Nur PDFs können im Browser angezeigt werden' });
    }

    return sendDocument(res, document, 'inline');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Anzeigen des Dokuments' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const document = await findGeneralDocumentForUser(req.params.id, req.user.id);
    if (!document) return res.status(404).json({ error: 'Dokument nicht gefunden' });

    await prisma.document.delete({ where: { id: document.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Dokuments' });
  }
});

module.exports = router;
