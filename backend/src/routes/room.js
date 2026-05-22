const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams needed to get propertyId from parent router
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

// Middleware to ensure the user owns the property
const verifyPropertyOwnership = async (req, res, next) => {
  const propertyId = req.params.propertyId || req.body.propertyId;
  if (!propertyId) return res.status(400).json({ error: 'Property ID required' });

  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });

  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  next();
};

// GET /api/properties/:propertyId/rooms
router.get('/', authenticateToken, verifyPropertyOwnership, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { propertyId: req.params.propertyId }
    });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Räume' });
  }
});

// POST /api/properties/:propertyId/rooms
router.post('/', authenticateToken, verifyPropertyOwnership, async (req, res) => {
  try {
    const { name, area, floorCovering, wallFinish, notes } = req.body;
    
    const room = await prisma.room.create({
      data: {
        propertyId: req.params.propertyId,
        name,
        area: parseFloat(area),
        floorCovering,
        wallFinish,
        notes
      }
    });
    
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Raumes' });
  }
});

// PUT /api/rooms/:id (global router without propertyId param initially, handled differently below if needed)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, area, floorCovering, wallFinish, notes } = req.body;
    
    // Check ownership
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updatedRoom = await prisma.room.update({
      where: { id: req.params.id },
      data: {
        name,
        area: parseFloat(area),
        floorCovering,
        wallFinish,
        notes
      }
    });
    
    res.json(updatedRoom);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Raumes' });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check ownership
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: { property: true }
    });
    
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.property.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.room.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler beim Löschen des Raumes' });
  }
});

module.exports = router;
