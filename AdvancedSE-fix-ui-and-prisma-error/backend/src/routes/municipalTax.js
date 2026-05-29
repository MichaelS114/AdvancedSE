const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const TAX_TYPES = ['Grundsteuer', 'Müll', 'Kanal', 'Wasser'];
const INTERVALS = ['MONATLICH', 'QUARTALSWEISE', 'HALBJÄHRLICH', 'JÄHRLICH'];

const getOwnedProperty = async (userId) => {
  return prisma.property.findUnique({
    where: { userId }
  });
};

const buildReminderData = (propertyId, tax) => {
  const dueDate = new Date(tax.dueDate);
  const remindAt = new Date(dueDate);
  remindAt.setDate(remindAt.getDate() - 14);

  return {
    propertyId,
    title: `${tax.type} fällig`,
    dueDate,
    remindAt,
    status: 'OPEN',
    sourceType: 'MUNICIPAL_TAX'
  };
};

const parseTaxPayload = (body) => {
  const amount = Number(body.amount);
  const dueDate = new Date(body.dueDate);

  if (!TAX_TYPES.includes(body.type)) {
    return { error: 'Ungültige Abgabenart' };
  }
  if (!INTERVALS.includes(body.interval)) {
    return { error: 'Ungültiges Zahlungsintervall' };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: 'Betrag ist ungültig' };
  }
  if (Number.isNaN(dueDate.getTime())) {
    return { error: 'Fälligkeit ist ungültig' };
  }

  return {
    data: {
      type: body.type,
      amount,
      interval: body.interval,
      dueDate,
      notes: body.notes || null
    }
  };
};

const includeRelations = {
  reminder: true,
  document: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      documentType: true,
      createdAt: true
    }
  }
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Objekt nicht gefunden' });

    const taxes = await prisma.municipalTax.findMany({
      where: { propertyId: property.id },
      include: includeRelations,
      orderBy: { dueDate: 'asc' }
    });

    const trendByYear = taxes.reduce((acc, tax) => {
      const year = new Date(tax.dueDate).getFullYear();
      acc[year] = (acc[year] || 0) + tax.amount;
      return acc;
    }, {});

    res.json({
      taxes,
      reminders: taxes.map((tax) => tax.reminder).filter(Boolean),
      trend: Object.entries(trendByYear).map(([year, total]) => ({
        year,
        total: Number(total.toFixed(2))
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Gemeindesteuern' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const property = await getOwnedProperty(req.user.id);
    if (!property) return res.status(404).json({ error: 'Bitte zuerst ein Objekt anlegen' });

    const parsed = parseTaxPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const tax = await prisma.$transaction(async (tx) => {
      const document = req.body.document?.dataUrl
        ? await tx.document.create({
            data: {
              propertyId: property.id,
              fileName: req.body.document.fileName,
              mimeType: req.body.document.mimeType || 'application/pdf',
              dataUrl: req.body.document.dataUrl,
              documentType: 'STEUERBESCHEID',
              sourceType: 'MUNICIPAL_TAX'
            }
          })
        : null;

      const createdTax = await tx.municipalTax.create({
        data: {
          propertyId: property.id,
          ...parsed.data,
          documentId: document?.id || null
        }
      });

      const reminder = await tx.reminder.create({
        data: {
          ...buildReminderData(property.id, createdTax),
          sourceId: createdTax.id
        }
      });

      return tx.municipalTax.update({
        where: { id: createdTax.id },
        data: { reminderId: reminder.id },
        include: includeRelations
      });
    });

    res.status(201).json(tax);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Abgabe' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await prisma.municipalTax.findUnique({
      where: { id: req.params.id },
      include: { property: true, document: true }
    });

    if (!existing) return res.status(404).json({ error: 'Abgabe nicht gefunden' });
    if (existing.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const parsed = parseTaxPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const tax = await prisma.$transaction(async (tx) => {
      let documentId = existing.documentId;

      if (req.body.document?.dataUrl) {
        if (existing.documentId) {
          await tx.document.update({
            where: { id: existing.documentId },
            data: {
              fileName: req.body.document.fileName,
              mimeType: req.body.document.mimeType || 'application/pdf',
              dataUrl: req.body.document.dataUrl,
              documentType: 'STEUERBESCHEID'
            }
          });
        } else {
          const document = await tx.document.create({
            data: {
              propertyId: existing.propertyId,
              fileName: req.body.document.fileName,
              mimeType: req.body.document.mimeType || 'application/pdf',
              dataUrl: req.body.document.dataUrl,
              documentType: 'STEUERBESCHEID',
              sourceType: 'MUNICIPAL_TAX',
              sourceId: existing.id
            }
          });
          documentId = document.id;
        }
      }

      const updatedTax = await tx.municipalTax.update({
        where: { id: existing.id },
        data: {
          ...parsed.data,
          documentId
        }
      });

      if (existing.reminderId) {
        await tx.reminder.update({
          where: { id: existing.reminderId },
          data: {
            ...buildReminderData(existing.propertyId, updatedTax),
            sourceId: updatedTax.id
          }
        });
      }

      return tx.municipalTax.findUnique({
        where: { id: existing.id },
        include: includeRelations
      });
    });

    res.json(tax);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren der Abgabe' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const tax = await prisma.municipalTax.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });

    if (!tax) return res.status(404).json({ error: 'Abgabe nicht gefunden' });
    if (tax.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.$transaction(async (tx) => {
      await tx.municipalTax.delete({ where: { id: tax.id } });
      if (tax.reminderId) {
        await tx.reminder.delete({ where: { id: tax.reminderId } });
      }
      if (tax.documentId) {
        await tx.document.delete({ where: { id: tax.documentId } });
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen der Abgabe' });
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

module.exports = router;
