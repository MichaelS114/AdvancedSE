const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

// GET /api/properties
// Holt das Objekt des aktuellen Benutzers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { userId: req.user.id },
      include: { rooms: true }
    });
    
    if (!property) {
      return res.status(404).json({ error: 'Objekt nicht gefunden' });
    }
    
    res.json(property);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen des Objekts' });
  }
});

// PUT /api/properties
// Aktualisiert oder erstellt das Objekt des aktuellen Benutzers
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { 
      address, 
      plotArea, 
      livingArea, 
      usableArea, 
      constructionYear, 
      plotNumber, 
      cadastralMunicipality 
    } = req.body;

    const userExists = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!userExists) {
      return res.status(401).json({ error: 'Benutzerkonto wurde gelöscht oder Datenbank zurückgesetzt. Bitte erneut anmelden.' });
    }

    const property = await prisma.property.upsert({
      where: { userId: req.user.id },
      update: {
        address,
        plotArea: parseFloat(plotArea),
        livingArea: parseFloat(livingArea),
        usableArea: parseFloat(usableArea),
        constructionYear: parseInt(constructionYear, 10),
        plotNumber,
        cadastralMunicipality
      },
      create: {
        userId: req.user.id,
        address,
        plotArea: parseFloat(plotArea),
        livingArea: parseFloat(livingArea),
        usableArea: parseFloat(usableArea),
        constructionYear: parseInt(constructionYear, 10),
        plotNumber,
        cadastralMunicipality
      }
    });

    res.json(property);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Speichern des Objekts' });
  }
});

module.exports = router;
