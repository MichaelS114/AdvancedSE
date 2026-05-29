const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const OFFER_INCLUDE = {
  project: true,
  contractor: true,
  services: { orderBy: { createdAt: 'asc' } }
};

const toDateOrNull = (value) => (value ? new Date(value) : null);

const normalizeServices = (items = [], type) => (
  items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((description) => ({ type, description }))
);

const assertProjectAndContractorAccess = async (userId, projectId, contractorId) => {
  const [project, contractor] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.contractor.findUnique({ where: { id: contractorId } })
  ]);

  if (!project) return { status: 404, error: 'Projekt nicht gefunden' };
  if (!contractor) return { status: 404, error: 'Handwerker nicht gefunden' };
  if (project.userId !== userId || contractor.userId !== userId) {
    return { status: 403, error: 'Forbidden' };
  }

  return { project, contractor };
};

const buildOfferData = (body) => ({
  projectId: body.projectId,
  contractorId: body.contractorId,
  amount: Number(body.price ?? body.amount) || 0,
  currency: body.currency || 'EUR',
  validUntil: toDateOrNull(body.validUntil),
  scopeDescription: body.scopeDescription || '',
  availabilityStart: toDateOrNull(body.availabilityStart),
  durationDays: Number(body.durationDays) || 0,
  notes: body.notes || null,
  pdfFileName: body.pdfFileName || null,
  pdfMimeType: body.pdfMimeType || null,
  pdfDataUrl: body.pdfDataUrl || null
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = {
      project: { userId: req.user.id }
    };

    if (req.query.projectId) {
      where.projectId = req.query.projectId;
    }

    const offers = await prisma.offer.findMany({
      where,
      include: OFFER_INCLUDE,
      orderBy: { updatedAt: 'desc' }
    });

    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Angebote' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { projectId, contractorId } = req.body;

    if (!projectId || !contractorId) {
      return res.status(400).json({ error: 'Projekt und Handwerker sind erforderlich' });
    }
    if (!req.body.validUntil || !req.body.scopeDescription || !req.body.availabilityStart) {
      return res.status(400).json({ error: 'Gültigkeit, Leistungsumfang und Verfügbarkeit sind erforderlich' });
    }

    const access = await assertProjectAndContractorAccess(req.user.id, projectId, contractorId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const offer = await prisma.offer.create({
      data: {
        ...buildOfferData(req.body),
        services: {
          create: [
            ...normalizeServices(req.body.includedServices, 'INCLUDED'),
            ...normalizeServices(req.body.excludedServices, 'EXCLUDED')
          ]
        }
      },
      include: OFFER_INCLUDE
    });

    res.status(201).json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Angebots' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existingOffer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    });

    if (!existingOffer) return res.status(404).json({ error: 'Angebot nicht gefunden' });
    if (existingOffer.project.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const access = await assertProjectAndContractorAccess(req.user.id, req.body.projectId, req.body.contractorId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    await prisma.offerService.deleteMany({ where: { offerId: req.params.id } });

    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: {
        ...buildOfferData(req.body),
        services: {
          create: [
            ...normalizeServices(req.body.includedServices, 'INCLUDED'),
            ...normalizeServices(req.body.excludedServices, 'EXCLUDED')
          ]
        }
      },
      include: OFFER_INCLUDE
    });

    res.json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Angebots' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existingOffer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { project: true }
    });

    if (!existingOffer) return res.status(404).json({ error: 'Angebot nicht gefunden' });
    if (existingOffer.project.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.offer.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Angebots' });
  }
});

module.exports = router;
