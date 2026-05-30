const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');

const ROLE_HAUSBESITZER = 'HAUSBESITZER';
const ROLE_PROFESSIONIST = 'PROFESSIONIST';

const includeThread = {
  offer: {
    include: {
      project: true,
      contractor: true
    }
  },
  messages: {
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  }
};

const assertOfferAccess = async (offerId, user) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      project: true,
      contractor: true
    }
  });

  if (!offer) return { status: 404, error: 'Angebot nicht gefunden' };
  if (user.role === ROLE_HAUSBESITZER && offer.project.userId !== user.id) {
    return { status: 403, error: 'Forbidden' };
  }
  if (user.role === ROLE_PROFESSIONIST && offer.contractor.userId !== user.id) {
    return { status: 403, error: 'Forbidden' };
  }
  if (![ROLE_HAUSBESITZER, ROLE_PROFESSIONIST].includes(user.role)) {
    return { status: 403, error: 'Forbidden' };
  }

  return { offer };
};

const assertThreadAccess = async (threadId, user) => {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: includeThread
  });

  if (!thread) return { status: 404, error: 'Chat nicht gefunden' };
  const access = await assertOfferAccess(thread.offerId, user);
  if (access.error) return access;

  return { thread };
};

const hydrateThread = (threadId) => prisma.chatThread.findUnique({
  where: { id: threadId },
  include: includeThread
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = req.user.role === ROLE_PROFESSIONIST
      ? { offer: { contractor: { userId: req.user.id } } }
      : { offer: { project: { userId: req.user.id } } };

    if (req.query.offerId) {
      where.offerId = req.query.offerId;
    }

    const threads = await prisma.chatThread.findMany({
      where,
      include: includeThread,
      orderBy: { updatedAt: 'desc' }
    });

    res.json(threads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Chats' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const access = await assertThreadAccess(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    res.json(access.thread);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen des Chats' });
  }
});

router.post('/offers/:offerId/messages', authenticateToken, async (req, res) => {
  try {
    const access = await assertOfferAccess(req.params.offerId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Nachricht darf nicht leer sein' });
    if (body.length > 2000) return res.status(400).json({ error: 'Nachricht darf maximal 2000 Zeichen haben' });

    const thread = await prisma.$transaction(async (tx) => {
      const savedThread = await tx.chatThread.upsert({
        where: { offerId: access.offer.id },
        update: { updatedAt: new Date() },
        create: { offerId: access.offer.id }
      });

      await tx.chatMessage.create({
        data: {
          threadId: savedThread.id,
          senderId: req.user.id,
          body
        }
      });

      await tx.chatThread.update({
        where: { id: savedThread.id },
        data: { updatedAt: new Date() }
      });

      return savedThread;
    });

    res.status(201).json(await hydrateThread(thread.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Senden der Nachricht' });
  }
});

module.exports = router;
