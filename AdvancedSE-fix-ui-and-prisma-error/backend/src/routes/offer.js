const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const ROLE_PROFESSIONIST = 'PROFESSIONIST';

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

const getPrimaryContractorForUser = async (userId) => {
  return prisma.contractor.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  });
};

const assertProfessionalOfferAccess = async (userId, projectId) => {
  const contractor = await getPrimaryContractorForUser(userId);
  if (!contractor) return { status: 400, error: 'Bitte zuerst ein Firmenprofil anlegen' };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { status: 404, error: 'Projekt nicht gefunden' };
  if (project.status !== 'IN_PLANUNG' || !project.trade || project.trade !== contractor.trade) {
    return { status: 403, error: 'Dieses Projekt ist fuer Ihr Gewerk nicht verfuegbar' };
  }

  return { project, contractor };
};

const buildOfferData = (body, contractorId) => ({
  projectId: body.projectId,
  contractorId,
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
    const where = req.user.role === ROLE_PROFESSIONIST
      ? { contractor: { userId: req.user.id } }
      : { project: { userId: req.user.id } };

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
    const { projectId } = req.body;

    if (req.user.role !== ROLE_PROFESSIONIST) {
      return res.status(403).json({ error: 'Angebote koennen nur von Professionisten erstellt werden' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'Projekt ist erforderlich' });
    }
    if (!req.body.validUntil || !req.body.scopeDescription || !req.body.availabilityStart) {
      return res.status(400).json({ error: 'Gueltigkeit, Leistungsumfang und Verfuegbarkeit sind erforderlich' });
    }

    const access = await assertProfessionalOfferAccess(req.user.id, projectId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const offer = await prisma.offer.create({
      data: {
        ...buildOfferData(req.body, access.contractor.id),
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
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Sie haben fuer dieses Projekt bereits ein Angebot erstellt' });
    }
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Angebots' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== ROLE_PROFESSIONIST) {
      return res.status(403).json({ error: 'Nur Professionisten koennen eigene offene Angebote bearbeiten' });
    }

    const existingOffer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { contractor: true }
    });

    if (!existingOffer) return res.status(404).json({ error: 'Angebot nicht gefunden' });
    if (existingOffer.contractor.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (existingOffer.status !== 'PENDING') return res.status(400).json({ error: 'Nur offene Angebote koennen bearbeitet werden' });

    const access = await assertProfessionalOfferAccess(req.user.id, req.body.projectId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    await prisma.offerService.deleteMany({ where: { offerId: req.params.id } });

    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: {
        ...buildOfferData(req.body, access.contractor.id),
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
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Sie haben fuer dieses Projekt bereits ein Angebot erstellt' });
    }
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Angebots' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    return res.status(403).json({ error: 'Angebote koennen nicht geloescht werden' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Loeschen des Angebots' });
  }
});

module.exports = router;
