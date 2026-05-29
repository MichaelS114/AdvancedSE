const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const POLICY_SOURCE = 'INSURANCE_POLICY';
const CLAIM_PHOTO_SOURCE = 'INSURANCE_CLAIM_PHOTO';
const MAX_CLAIM_PHOTOS = 10;

const getOwnedProperty = (userId) => prisma.property.findUnique({ where: { userId } });

const documentSummary = {
  id: true,
  fileName: true,
  mimeType: true,
  documentType: true,
  fileSize: true,
  sourceType: true,
  sourceId: true,
  createdAt: true
};

const normalizePolicy = (body) => ({
  provider: body.provider?.trim(),
  policyNumber: body.policyNumber?.trim(),
  hotline: body.hotline?.trim() || null,
  deductible: body.deductible === null || body.deductible === undefined || body.deductible === ''
    ? null
    : Number(body.deductible)
});

const normalizeClaim = (body) => {
  const claimDate = new Date(body.claimDate);
  return {
    claimDate,
    type: body.type?.trim(),
    description: body.description?.trim()
  };
};

const validatePolicy = (data) => {
  if (!data.provider) return 'Versicherer ist erforderlich';
  if (!data.policyNumber) return 'Polizzennummer ist erforderlich';
  if (data.deductible !== null && (!Number.isFinite(data.deductible) || data.deductible < 0)) {
    return 'Selbstbehalt ist ungültig';
  }
  return null;
};

const validateClaim = (data, photos = []) => {
  if (Number.isNaN(data.claimDate.getTime())) return 'Schadensdatum ist ungültig';
  if (!data.type) return 'Schadenstyp ist erforderlich';
  if (!data.description) return 'Beschreibung ist erforderlich';
  if (photos.length > MAX_CLAIM_PHOTOS) return `Maximal ${MAX_CLAIM_PHOTOS} Fotos pro Schadensfall erlaubt`;
  if (photos.some((photo) => !photo.mimeType?.startsWith('image/') || !photo.dataUrl)) {
    return 'Fotos müssen Bilddateien sein';
  }
  return null;
};

const createDocumentData = (propertyId, file, documentType, sourceType, sourceId = null) => ({
  propertyId,
  fileName: file.fileName,
  mimeType: file.mimeType,
  dataUrl: file.dataUrl,
  fileSize: file.fileSize || null,
  title: file.title || file.fileName,
  documentType,
  sourceType,
  sourceId
});

const attachDocuments = async (items, sourceType, idField = 'id', targetField = 'documents') => {
  const ids = items.map((item) => item[idField]);
  if (ids.length === 0) return items;

  const documents = await prisma.document.findMany({
    where: { sourceType, sourceId: { in: ids } },
    select: documentSummary,
    orderBy: { createdAt: 'asc' }
  });

  const bySource = documents.reduce((acc, document) => {
    if (!acc[document.sourceId]) acc[document.sourceId] = [];
    acc[document.sourceId].push(document);
    return acc;
  }, {});

  return items.map((item) => ({
    ...item,
    [targetField]: bySource[item[idField]] || []
  }));
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Bitte zuerst ein Objekt anlegen' });

    const [policiesRaw, claimsRaw] = await Promise.all([
      prisma.insurancePolicy.findMany({
        where: { propertyId: property.id },
        orderBy: [{ provider: 'asc' }, { updatedAt: 'desc' }]
      }),
      prisma.insuranceClaim.findMany({
        where: { propertyId: property.id },
        orderBy: { claimDate: 'desc' }
      })
    ]);

    const policies = await attachDocuments(policiesRaw, POLICY_SOURCE, 'id', 'documents');
    const claims = await attachDocuments(claimsRaw, CLAIM_PHOTO_SOURCE, 'id', 'photos');

    res.json({ policies, claims, maxPhotosPerClaim: MAX_CLAIM_PHOTOS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Versicherungsdaten' });
  }
});

router.post('/policies', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Bitte zuerst ein Objekt anlegen' });

    const data = normalizePolicy(req.body);
    const validationError = validatePolicy(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const policy = await prisma.$transaction(async (tx) => {
      const created = await tx.insurancePolicy.create({ data: { propertyId: property.id, ...data } });

      if (req.body.pdf?.dataUrl) {
        if (req.body.pdf.mimeType !== 'application/pdf') {
          throw new Error('POLICY_PDF_INVALID');
        }
        const document = await tx.document.create({
          data: createDocumentData(property.id, req.body.pdf, 'VERSICHERUNGSPOLIZZE', POLICY_SOURCE, created.id)
        });
        return tx.insurancePolicy.update({
          where: { id: created.id },
          data: { pdfDocumentId: document.id }
        });
      }

      return created;
    });

    const [withDocuments] = await attachDocuments([policy], POLICY_SOURCE, 'id', 'documents');
    res.status(201).json(withDocuments);
  } catch (err) {
    if (err.message === 'POLICY_PDF_INVALID') return res.status(400).json({ error: 'Polizze muss eine PDF-Datei sein' });
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Versicherung' });
  }
});

router.put('/policies/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await prisma.insurancePolicy.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    if (!existing) return res.status(404).json({ error: 'Versicherung nicht gefunden' });
    if (existing.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const data = normalizePolicy(req.body);
    const validationError = validatePolicy(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const policy = await prisma.$transaction(async (tx) => {
      let pdfDocumentId = existing.pdfDocumentId;
      if (req.body.pdf?.dataUrl) {
        if (req.body.pdf.mimeType !== 'application/pdf') {
          throw new Error('POLICY_PDF_INVALID');
        }
        if (existing.pdfDocumentId) {
          await tx.document.update({
            where: { id: existing.pdfDocumentId },
            data: createDocumentData(existing.propertyId, req.body.pdf, 'VERSICHERUNGSPOLIZZE', POLICY_SOURCE, existing.id)
          });
        } else {
          const document = await tx.document.create({
            data: createDocumentData(existing.propertyId, req.body.pdf, 'VERSICHERUNGSPOLIZZE', POLICY_SOURCE, existing.id)
          });
          pdfDocumentId = document.id;
        }
      }

      return tx.insurancePolicy.update({
        where: { id: existing.id },
        data: { ...data, pdfDocumentId }
      });
    });

    const [withDocuments] = await attachDocuments([policy], POLICY_SOURCE, 'id', 'documents');
    res.json(withDocuments);
  } catch (err) {
    if (err.message === 'POLICY_PDF_INVALID') return res.status(400).json({ error: 'Polizze muss eine PDF-Datei sein' });
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren der Versicherung' });
  }
});

router.delete('/policies/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await prisma.insurancePolicy.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    if (!existing) return res.status(404).json({ error: 'Versicherung nicht gefunden' });
    if (existing.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.$transaction([
      prisma.document.deleteMany({ where: { sourceType: POLICY_SOURCE, sourceId: existing.id } }),
      prisma.insurancePolicy.delete({ where: { id: existing.id } })
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen der Versicherung' });
  }
});

router.post('/claims', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Bitte zuerst ein Objekt anlegen' });

    const photos = req.body.photos || [];
    const data = normalizeClaim(req.body);
    const validationError = validateClaim(data, photos);
    if (validationError) return res.status(400).json({ error: validationError });

    const claim = await prisma.$transaction(async (tx) => {
      const created = await tx.insuranceClaim.create({ data: { propertyId: property.id, ...data } });
      if (photos.length > 0) {
        await tx.document.createMany({
          data: photos.map((photo) => createDocumentData(property.id, photo, 'SCHADENSFOTO', CLAIM_PHOTO_SOURCE, created.id))
        });
      }
      return created;
    });

    const [withPhotos] = await attachDocuments([claim], CLAIM_PHOTO_SOURCE, 'id', 'photos');
    res.status(201).json(withPhotos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Schadensfalls' });
  }
});

router.put('/claims/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await prisma.insuranceClaim.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    if (!existing) return res.status(404).json({ error: 'Schadensfall nicht gefunden' });
    if (existing.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const photos = req.body.photos || [];
    const data = normalizeClaim(req.body);
    const validationError = validateClaim(data, photos);
    if (validationError) return res.status(400).json({ error: validationError });

    const claim = await prisma.$transaction(async (tx) => {
      if (req.body.replacePhotos) {
        await tx.document.deleteMany({ where: { sourceType: CLAIM_PHOTO_SOURCE, sourceId: existing.id } });
        if (photos.length > 0) {
          await tx.document.createMany({
            data: photos.map((photo) => createDocumentData(existing.propertyId, photo, 'SCHADENSFOTO', CLAIM_PHOTO_SOURCE, existing.id))
          });
        }
      }
      return tx.insuranceClaim.update({
        where: { id: existing.id },
        data
      });
    });

    const [withPhotos] = await attachDocuments([claim], CLAIM_PHOTO_SOURCE, 'id', 'photos');
    res.json(withPhotos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Schadensfalls' });
  }
});

router.delete('/claims/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await prisma.insuranceClaim.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    if (!existing) return res.status(404).json({ error: 'Schadensfall nicht gefunden' });
    if (existing.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.$transaction([
      prisma.document.deleteMany({ where: { sourceType: CLAIM_PHOTO_SOURCE, sourceId: existing.id } }),
      prisma.insuranceClaim.delete({ where: { id: existing.id } })
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Schadensfalls' });
  }
});

router.get('/documents/:id/download', authenticateToken, async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    if (!document) return res.status(404).json({ error: 'Dokument nicht gefunden' });
    if (document.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    res.json({
      fileName: document.fileName,
      mimeType: document.mimeType,
      dataUrl: document.dataUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen des Dokuments' });
  }
});

router.post('/claims/:id/export', authenticateToken, async (req, res) => {
  try {
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    if (!claim) return res.status(404).json({ error: 'Schadensfall nicht gefunden' });
    if (claim.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const exportToken = claim.exportToken || crypto.randomBytes(18).toString('hex');
    const updated = claim.exportToken
      ? claim
      : await prisma.insuranceClaim.update({ where: { id: claim.id }, data: { exportToken } });

    const photos = await prisma.document.findMany({
      where: { sourceType: CLAIM_PHOTO_SOURCE, sourceId: claim.id },
      select: documentSummary,
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      claimId: updated.id,
      fileName: `Schadensfall-${updated.id}.pdf`,
      mode: 'PDF_BUNDLE_OR_SHARE_LINK_READY',
      shareLink: `/share/insurance-claims/${exportToken}`,
      includedPhotos: photos.length,
      documents: photos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export konnte nicht vorbereitet werden' });
  }
});

module.exports = router;
