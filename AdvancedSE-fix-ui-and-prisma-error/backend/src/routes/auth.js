const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
const USER_ROLES = new Set(['HAUSBESITZER', 'PROFESSIONIST']);

const normalizeContractorData = (body) => ({
  companyName: body.companyName,
  trade: body.trade,
  contactPerson: body.contactPerson || null,
  phone: body.phone || null,
  email: body.contractorEmail || body.email || null,
  address: body.address || null,
  notes: body.notes || null,
  experience: body.experience || null
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, role } = req.body;
    const normalizedRole = role || 'HAUSBESITZER';

    if (!USER_ROLES.has(normalizedRole)) {
      return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    if (normalizedRole === 'PROFESSIONIST' && (!req.body.companyName || !req.body.trade)) {
      return res.status(400).json({ error: 'Firmenname und Gewerk sind für Professionisten erforderlich' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          firstName,
          lastName,
          username,
          email,
          password: hashedPassword,
          role: normalizedRole
        }
      });

      if (normalizedRole === 'PROFESSIONIST') {
        await tx.contractor.create({
          data: {
            userId: createdUser.id,
            ...normalizeContractorData(req.body)
          }
        });
      }

      return createdUser;
    });

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const { authenticateToken } = require('../middleware/auth');

// PUT /api/auth/password - Passwort ändern
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

    // Verify old password
    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Das alte Passwort ist falsch' });
    }

    // Hash and update new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Passwort erfolgreich geändert' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Ändern des Passworts' });
  }
});

module.exports = router;
