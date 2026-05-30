const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const SORT_FIELDS = new Set(['companyName', 'trade', 'contactPerson', 'createdAt', 'updatedAt']);

const normalizeContractorData = (body) => ({
  companyName: body.companyName,
  trade: body.trade,
  contactPerson: body.contactPerson || null,
  phone: body.phone || null,
  email: body.email || null,
  address: body.address || null,
  notes: body.notes || null,
  experience: body.experience || null
});

const buildWhere = (userId, query) => {
  const where = { userId };

  if (query.trade) {
    where.trade = query.trade;
  }

  if (query.search) {
    const contains = query.search;
    where.OR = [
      { companyName: { contains } },
      { trade: { contains } },
      { contactPerson: { contains } },
      { phone: { contains } },
      { email: { contains } },
      { address: { contains } },
      { notes: { contains } },
      { experience: { contains } }
    ];
  }

  return where;
};

// GET /api/contractors
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sortBy = SORT_FIELDS.has(req.query.sortBy) ? req.query.sortBy : 'companyName';
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';

    const contractors = await prisma.contractor.findMany({
      where: buildWhere(req.user.id, req.query),
      orderBy: { [sortBy]: sortOrder }
    });

    res.json(contractors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Handwerker' });
  }
});

// GET /api/contractors/trades
router.get('/trades', authenticateToken, async (req, res) => {
  try {
    const rows = await prisma.contractor.findMany({
      where: { userId: req.user.id },
      select: { trade: true },
      distinct: ['trade'],
      orderBy: { trade: 'asc' }
    });

    res.json(rows.map((row) => row.trade));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Gewerke' });
  }
});

// POST /api/contractors
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { companyName, trade } = req.body;
    if (!companyName || !trade) {
      return res.status(400).json({ error: 'Firmenname und Gewerk sind erforderlich' });
    }
    if (req.user.role === 'PROFESSIONIST') {
      const existing = await prisma.contractor.findFirst({ where: { userId: req.user.id } });
      if (existing) return res.status(409).json({ error: 'Professionisten können nur ein Firmenprofil führen' });
    }

    const contractor = await prisma.contractor.create({
      data: {
        userId: req.user.id,
        ...normalizeContractorData(req.body)
      }
    });

    res.status(201).json(contractor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Handwerkers' });
  }
});

// PUT /api/contractors/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existingContractor = await prisma.contractor.findUnique({
      where: { id: req.params.id }
    });

    if (!existingContractor) return res.status(404).json({ error: 'Handwerker nicht gefunden' });
    if (existingContractor.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { companyName, trade } = req.body;
    if (!companyName || !trade) {
      return res.status(400).json({ error: 'Firmenname und Gewerk sind erforderlich' });
    }

    const contractor = await prisma.contractor.update({
      where: { id: req.params.id },
      data: normalizeContractorData(req.body)
    });

    res.json(contractor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Handwerkers' });
  }
});

// DELETE /api/contractors/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'PROFESSIONIST') {
      return res.status(403).json({ error: 'Das Firmenprofil kann nicht gelöscht werden' });
    }

    const existingContractor = await prisma.contractor.findUnique({
      where: { id: req.params.id }
    });

    if (!existingContractor) return res.status(404).json({ error: 'Handwerker nicht gefunden' });
    if (existingContractor.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.contractor.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Handwerkers' });
  }
});

module.exports = router;
