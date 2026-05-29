const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const PROJECT_STATUSES = ['IN_PLANUNG', 'BEAUFTRAGT', 'IN_UMSETZUNG', 'ABGESCHLOSSEN', 'STORNIERT'];

const includeProjectDetails = {
  offers: {
    include: {
      contractor: true,
      services: { orderBy: { createdAt: 'asc' } }
    },
    orderBy: { createdAt: 'desc' }
  },
  reviews: true
};

const toDateOrNull = (value) => (value ? new Date(value) : null);
const toFloat = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateRating = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
};

const normalizeProjectData = (body, userId, propertyId) => ({
  userId,
  propertyId: body.propertyId || propertyId || null,
  title: body.title,
  category: body.category || 'Sanierung',
  description: body.description || null,
  targetBudget: Number(body.targetBudget) || 0,
  desiredStartDate: toDateOrNull(body.desiredStartDate),
  desiredDeadline: toDateOrNull(body.desiredDeadline),
  status: PROJECT_STATUSES.includes(body.status) ? body.status : 'IN_PLANUNG',
  documentReference: body.documentReference || null
});

const mapProject = (project) => {
  const acceptedOffer = project.offers?.find((offer) => offer.id === project.acceptedOfferId || offer.status === 'ACCEPTED') || null;

  return {
    ...project,
    acceptedOffer,
    canReview: Boolean(project.finalInvoiceAmount && acceptedOffer)
  };
};

const getUserPropertyId = async (userId) => {
  const property = await prisma.property.findUnique({
    where: { userId },
    select: { id: true }
  });

  return property?.id || null;
};

const getProjectForUser = async (projectId, userId) => {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: includeProjectDetails
  });
};

const getOfferForUser = async (offerId, userId) => {
  return prisma.offer.findFirst({
    where: {
      id: offerId,
      project: { userId }
    },
    include: {
      project: true,
      contractor: true
    }
  });
};

const offerManagementProjectSelect = {
  id: true,
  title: true,
  category: true,
  description: true,
  targetBudget: true,
  desiredStartDate: true,
  desiredDeadline: true,
  status: true,
  documentReference: true,
  propertyId: true,
  updatedAt: true
};

const recalculateContractorRating = async (tx, contractorId) => {
  const aggregate = await tx.contractorReview.aggregate({
    where: { contractorId },
    _avg: { average: true },
    _count: { average: true }
  });

  await tx.contractor.update({
    where: { id: contractorId },
    data: {
      averageRating: aggregate._avg.average,
      ratingCount: aggregate._count.average
    }
  });
};

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: req.user.id,
        status: { in: ['IN_PLANUNG', 'BEAUFTRAGT', 'IN_UMSETZUNG'] }
      },
      include: includeProjectDetails,
      orderBy: [
        { desiredDeadline: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: 5
    });

    res.json(projects.map(mapProject));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen aktiver Projekte' });
  }
});

router.get('/offer-management', authenticateToken, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      select: offerManagementProjectSelect,
      orderBy: [
        { desiredDeadline: 'asc' },
        { title: 'asc' }
      ]
    });

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Bereitstellen der Projektdaten' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = { userId: req.user.id };
    if (req.query.status) where.status = req.query.status;

    const projects = await prisma.project.findMany({
      where,
      include: includeProjectDetails,
      orderBy: { updatedAt: 'desc' }
    });

    res.json(projects.map(mapProject));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Projekte' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!req.body.title) {
      return res.status(400).json({ error: 'Projekttitel ist erforderlich' });
    }

    const propertyId = await getUserPropertyId(req.user.id);
    const project = await prisma.project.create({
      data: normalizeProjectData(req.body, req.user.id, propertyId),
      include: includeProjectDetails
    });

    res.status(201).json(mapProject(project));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Projekts' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!existingProject) return res.status(404).json({ error: 'Projekt nicht gefunden' });
    if (existingProject.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!req.body.title) return res.status(400).json({ error: 'Projekttitel ist erforderlich' });

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        category: req.body.category || 'Sanierung',
        description: req.body.description || null,
        targetBudget: Number(req.body.targetBudget) || 0,
        desiredStartDate: toDateOrNull(req.body.desiredStartDate),
        desiredDeadline: toDateOrNull(req.body.desiredDeadline),
        status: PROJECT_STATUSES.includes(req.body.status) ? req.body.status : existingProject.status,
        documentReference: req.body.documentReference || null
      },
      include: includeProjectDetails
    });

    res.json(mapProject(project));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Projekts' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existingProject = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!existingProject) return res.status(404).json({ error: 'Projekt nicht gefunden' });
    if (existingProject.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Projekts' });
  }
});

router.post('/:id/offers', authenticateToken, async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });

    const amount = toFloat(req.body.amount);
    if (!req.body.contractorId || amount === null || amount < 0) {
      return res.status(400).json({ error: 'Handwerker und Angebotssumme sind erforderlich' });
    }

    const contractor = await prisma.contractor.findFirst({
      where: { id: req.body.contractorId, userId: req.user.id }
    });
    if (!contractor) return res.status(404).json({ error: 'Handwerker nicht gefunden' });

    const offer = await prisma.offer.create({
      data: {
        projectId: project.id,
        contractorId: contractor.id,
        amount,
        currency: req.body.currency || 'EUR',
        validUntil: toDateOrNull(req.body.validUntil),
        scopeDescription: req.body.scopeDescription || req.body.notes || '',
        availabilityStart: toDateOrNull(req.body.availabilityStart),
        durationDays: Number(req.body.durationDays) || 0,
        notes: req.body.notes || null,
        pdfFileName: req.body.pdfFileName || null,
        pdfMimeType: req.body.pdfMimeType || 'application/pdf',
        pdfDataUrl: req.body.pdfDataUrl || null
      },
      include: { contractor: true, services: true }
    });

    res.status(201).json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Angebots' });
  }
});

router.post('/offers/:offerId/accept', authenticateToken, async (req, res) => {
  try {
    const offer = await getOfferForUser(req.params.offerId, req.user.id);
    if (!offer) return res.status(404).json({ error: 'Angebot nicht gefunden' });

    const updatedProject = await prisma.$transaction(async (tx) => {
      await tx.offer.updateMany({
        where: {
          projectId: offer.projectId,
          id: { not: offer.id }
        },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date()
        }
      });

      await tx.offer.update({
        where: { id: offer.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          rejectedAt: null
        }
      });

      return tx.project.update({
        where: { id: offer.projectId },
        data: {
          status: 'BEAUFTRAGT',
          acceptedOfferId: offer.id,
          orderConfirmationFileName: req.body.orderConfirmationFileName || null,
          orderConfirmationDataUrl: req.body.orderConfirmationDataUrl || null,
          finalContractFileName: req.body.finalContractFileName || null,
          finalContractDataUrl: req.body.finalContractDataUrl || null
        },
        include: includeProjectDetails
      });
    });

    res.json(mapProject(updatedProject));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Annehmen des Angebots' });
  }
});

router.post('/:id/final-invoice', authenticateToken, async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });

    const acceptedOffer = project.offers.find((offer) => offer.id === project.acceptedOfferId || offer.status === 'ACCEPTED');
    if (!acceptedOffer) return res.status(400).json({ error: 'Es muss zuerst ein Angebot angenommen werden' });

    const finalInvoiceAmount = toFloat(req.body.finalInvoiceAmount);
    if (finalInvoiceAmount === null || finalInvoiceAmount < 0) {
      return res.status(400).json({ error: 'Finale Rechnungssumme ist erforderlich' });
    }

    const invoiceDeviationEuro = finalInvoiceAmount - acceptedOffer.amount;
    const invoiceDeviationPercent = acceptedOffer.amount === 0 ? 0 : (invoiceDeviationEuro / acceptedOffer.amount) * 100;
    const invoiceDeviationWarning = Math.abs(invoiceDeviationPercent) > 5;

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'ABGESCHLOSSEN',
        finalInvoiceAmount,
        finalInvoiceFileName: req.body.finalInvoiceFileName || null,
        finalInvoiceDataUrl: req.body.finalInvoiceDataUrl || null,
        invoiceDeviationEuro,
        invoiceDeviationPercent,
        invoiceDeviationWarning
      },
      include: includeProjectDetails
    });

    res.json(mapProject(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Schlussrechnung' });
  }
});

router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });
    if (!project.finalInvoiceAmount) {
      return res.status(400).json({ error: 'Bewertungen sind erst nach der Schlussrechnung möglich' });
    }

    const acceptedOffer = project.offers.find((offer) => offer.id === project.acceptedOfferId || offer.status === 'ACCEPTED');
    if (!acceptedOffer) return res.status(400).json({ error: 'Kein angenommener Handwerker gefunden' });

    const ratingValues = {
      priceFaithful: validateRating(req.body.priceFaithful),
      punctuality: validateRating(req.body.punctuality),
      speed: validateRating(req.body.speed),
      quality: validateRating(req.body.quality)
    };

    if (Object.values(ratingValues).some((value) => value === null)) {
      return res.status(400).json({ error: 'Alle Bewertungskriterien müssen zwischen 1 und 5 liegen' });
    }

    const average = Object.values(ratingValues).reduce((sum, value) => sum + value, 0) / 4;

    const review = await prisma.$transaction(async (tx) => {
      const savedReview = await tx.contractorReview.upsert({
        where: {
          projectId_contractorId: {
            projectId: project.id,
            contractorId: acceptedOffer.contractorId
          }
        },
        update: {
          ...ratingValues,
          average,
          notes: req.body.notes || null
        },
        create: {
          projectId: project.id,
          contractorId: acceptedOffer.contractorId,
          ...ratingValues,
          average,
          notes: req.body.notes || null
        }
      });

      await recalculateContractorRating(tx, acceptedOffer.contractorId);
      return savedReview;
    });

    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Bewertung' });
  }
});

module.exports = router;
