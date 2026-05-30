const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');
const { MAX_ROUNDS, createAgentMessage, evaluateDeal } = require('../services/negotiationAgent');

const ROLE_HAUSBESITZER = 'HAUSBESITZER';
const ROLE_PROFESSIONIST = 'PROFESSIONIST';
const TERMINAL_STATUSES = new Set(['CONFIRMED', 'FAILED', 'CANCELLED']);

const includeSession = {
  offer: {
    include: {
      project: true,
      contractor: true,
      services: { orderBy: { createdAt: 'asc' } }
    }
  },
  messages: { orderBy: { createdAt: 'asc' } }
};

const toPrice = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const assertOfferAccess = async (offerId, user) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      project: true,
      contractor: true,
      services: { orderBy: { createdAt: 'asc' } }
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

const assertSessionAccess = async (sessionId, user) => {
  const session = await prisma.negotiationSession.findUnique({
    where: { id: sessionId },
    include: includeSession
  });

  if (!session) return { status: 404, error: 'Verhandlung nicht gefunden' };
  const access = await assertOfferAccess(session.offerId, user);
  if (access.error) return access;
  return { session };
};

const upsertSystemMessage = (tx, sessionId, text) => tx.negotiationMessage.create({
  data: {
    sessionId,
    role: 'SYSTEM',
    text,
    metadata: '{}'
  }
});

const hydrateSession = (id) => prisma.negotiationSession.findUnique({
  where: { id },
  include: includeSession
});

const getAgentProvider = () => {
  if (process.env.AI_PROVIDER === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.AI_PROVIDER === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  return 'mock';
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = req.user.role === ROLE_PROFESSIONIST
      ? { offer: { contractor: { userId: req.user.id } } }
      : { offer: { project: { userId: req.user.id } } };

    if (req.query.offerId) {
      where.offerId = req.query.offerId;
    }

    const sessions = await prisma.negotiationSession.findMany({
      where,
      include: includeSession,
      orderBy: { updatedAt: 'desc' }
    });

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Verhandlungen' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const access = await assertSessionAccess(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    res.json(access.session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Verhandlung' });
  }
});

router.post('/offers/:offerId/customer-limits', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== ROLE_HAUSBESITZER) return res.status(403).json({ error: 'Forbidden' });

    const access = await assertOfferAccess(req.params.offerId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.offer.status !== 'PENDING') return res.status(400).json({ error: 'Nur offene Angebote koennen verhandelt werden' });

    const customerTargetPrice = toPrice(req.body.customerTargetPrice);
    const customerMaxPrice = toPrice(req.body.customerMaxPrice);
    if (customerTargetPrice === null || customerMaxPrice === null || customerTargetPrice > customerMaxPrice) {
      return res.status(400).json({ error: 'Zielpreis muss kleiner oder gleich Maximalpreis sein' });
    }

    const session = await prisma.$transaction(async (tx) => {
      const saved = await tx.negotiationSession.upsert({
        where: { offerId: access.offer.id },
        update: {
          customerTargetPrice,
          customerMaxPrice,
          status: 'DRAFT',
          finalProposalAmount: null,
          customerConfirmedAt: null,
          contractorConfirmedAt: null
        },
        create: {
          offerId: access.offer.id,
          customerTargetPrice,
          customerMaxPrice
        }
      });

      await upsertSystemMessage(tx, saved.id, 'Der Kundenagent wurde mit Preisgrenzen vorbereitet.');
      return saved;
    });

    res.status(201).json(await hydrateSession(session.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Kundenlimits' });
  }
});

router.post('/offers/:offerId/contractor-limits', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== ROLE_PROFESSIONIST) return res.status(403).json({ error: 'Forbidden' });

    const access = await assertOfferAccess(req.params.offerId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.offer.status !== 'PENDING') return res.status(400).json({ error: 'Nur offene Angebote koennen verhandelt werden' });

    const contractorTargetPrice = toPrice(req.body.contractorTargetPrice);
    const contractorMinPrice = toPrice(req.body.contractorMinPrice);
    if (contractorTargetPrice === null || contractorMinPrice === null || contractorMinPrice > contractorTargetPrice) {
      return res.status(400).json({ error: 'Mindestpreis muss kleiner oder gleich Zielpreis sein' });
    }

    const session = await prisma.$transaction(async (tx) => {
      const saved = await tx.negotiationSession.upsert({
        where: { offerId: access.offer.id },
        update: {
          contractorTargetPrice,
          contractorMinPrice,
          status: 'DRAFT',
          finalProposalAmount: null,
          customerConfirmedAt: null,
          contractorConfirmedAt: null
        },
        create: {
          offerId: access.offer.id,
          contractorTargetPrice,
          contractorMinPrice
        }
      });

      await upsertSystemMessage(tx, saved.id, 'Der Professionistenagent wurde mit Preisgrenzen vorbereitet.');
      return saved;
    });

    res.status(201).json(await hydrateSession(session.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Professionistenlimits' });
  }
});

router.post('/:id/step', authenticateToken, async (req, res) => {
  try {
    const access = await assertSessionAccess(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { session } = access;
    if (TERMINAL_STATUSES.has(session.status)) {
      return res.status(400).json({ error: 'Diese Verhandlung ist bereits beendet' });
    }
    if (session.offer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Nur offene Angebote koennen verhandelt werden' });
    }
    if (!session.customerTargetPrice || !session.customerMaxPrice || !session.contractorTargetPrice || !session.contractorMinPrice) {
      return res.status(400).json({ error: 'Beide Seiten muessen zuerst Preisgrenzen setzen' });
    }
    if (session.status === 'DEAL_PROPOSED') {
      return res.status(400).json({ error: 'Es liegt bereits ein Deal-Vorschlag vor' });
    }

    const agentMessages = session.messages.filter((message) => ['CUSTOMER_AGENT', 'CONTRACTOR_AGENT'].includes(message.role));
    const nextRole = agentMessages.length % 2 === 0 ? 'CUSTOMER_AGENT' : 'CONTRACTOR_AGENT';
    const round = Math.floor(agentMessages.length / 2) + 1;

    if (round > MAX_ROUNDS) {
      const failed = await prisma.negotiationSession.update({
        where: { id: session.id },
        data: { status: 'FAILED' },
        include: includeSession
      });
      return res.json(failed);
    }

    const agentResult = await createAgentMessage({
      session,
      offer: session.offer,
      actorRole: nextRole,
      round,
      messages: session.messages
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.negotiationMessage.create({
        data: {
          sessionId: session.id,
          role: nextRole,
          text: agentResult.text,
          priceProposal: agentResult.priceProposal,
          round,
          metadata: JSON.stringify({
            provider: getAgentProvider()
          })
        }
      });

      const withMessage = await tx.negotiationSession.findUnique({
        where: { id: session.id },
        include: includeSession
      });
      const deal = evaluateDeal(withMessage, withMessage.messages);

      if (deal !== null) {
        await upsertSystemMessage(tx, session.id, `Deal-Vorschlag gefunden: ${deal.toFixed(2)} EUR.`);
        return tx.negotiationSession.update({
          where: { id: session.id },
          data: {
            status: 'DEAL_PROPOSED',
            finalProposalAmount: deal,
            customerConfirmedAt: null,
            contractorConfirmedAt: null
          },
          include: includeSession
        });
      }

      return tx.negotiationSession.update({
        where: { id: session.id },
        data: { status: 'RUNNING' },
        include: includeSession
      });
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Ausfuehren der Verhandlungsrunde' });
  }
});

router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const access = await assertSessionAccess(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { session } = access;
    if (session.status !== 'DEAL_PROPOSED') {
      return res.status(400).json({ error: 'Es gibt keinen bestaetigbaren Deal-Vorschlag' });
    }

    const now = new Date();
    const customerConfirmedAt = req.user.role === ROLE_HAUSBESITZER ? now : session.customerConfirmedAt;
    const contractorConfirmedAt = req.user.role === ROLE_PROFESSIONIST ? now : session.contractorConfirmedAt;

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.negotiationSession.update({
        where: { id: session.id },
        data: {
          customerConfirmedAt,
          contractorConfirmedAt
        },
        include: includeSession
      });

      await upsertSystemMessage(
        tx,
        session.id,
        req.user.role === ROLE_HAUSBESITZER ? 'Der Hausbesitzer hat den Deal bestaetigt.' : 'Der Professionist hat den Deal bestaetigt.'
      );

      if (customerConfirmedAt && contractorConfirmedAt) {
        await tx.offer.update({
          where: { id: session.offerId },
          data: { amount: session.finalProposalAmount }
        });

        return tx.negotiationSession.update({
          where: { id: session.id },
          data: { status: 'CONFIRMED' },
          include: includeSession
        });
      }

      return saved;
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Bestaetigen der Verhandlung' });
  }
});

router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const access = await assertSessionAccess(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.session.status === 'CONFIRMED') {
      return res.status(400).json({ error: 'Bestaetigte Verhandlungen koennen nicht abgebrochen werden' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await upsertSystemMessage(tx, access.session.id, 'Die Verhandlung wurde abgebrochen.');
      return tx.negotiationSession.update({
        where: { id: access.session.id },
        data: { status: 'CANCELLED' },
        include: includeSession
      });
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serverfehler beim Abbrechen der Verhandlung' });
  }
});

module.exports = router;
