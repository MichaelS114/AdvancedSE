const MAX_ROUNDS = 6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;
const formatEuro = (value) => `${roundMoney(value).toFixed(2)} EUR`;
const DAY_MS = 24 * 60 * 60 * 1000;

const MARKET_HOURLY_RANGES = {
  Elektrik: { low: 75, high: 125 },
  Sanitaer: { low: 80, high: 135 },
  Sanitär: { low: 80, high: 135 },
  Heizung: { low: 85, high: 145 },
  Dach: { low: 80, high: 135 },
  Fenster: { low: 70, high: 120 },
  Maler: { low: 60, high: 105 },
  Boden: { low: 60, high: 105 },
  Generalunternehmer: { low: 85, high: 150 },
  default: { low: 70, high: 125 }
};

const SERVICE_COMPLEXITY_TERMS = [
  'demontage',
  'entsorgung',
  'abdichtung',
  'stemmen',
  'installation',
  'montage',
  'sanierung',
  'anschluss',
  'verlegung',
  'planung',
  'koordination',
  'material',
  'notdienst'
];

const getLastProposal = (messages, role) => {
  return [...messages].reverse().find((message) => message.role === role && message.priceProposal !== null);
};

const getLastPublicCounterPrice = (messages, actorRole) => {
  const counterRole = actorRole === 'CUSTOMER_AGENT' ? 'CONTRACTOR_AGENT' : 'CUSTOMER_AGENT';
  const counter = getLastProposal(messages, counterRole);
  return counter ? Number(counter.priceProposal) : null;
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const getServiceDescriptions = (offer, type) => (
  offer.services?.filter((service) => service.type === type).map((service) => service.description).filter(Boolean) || []
);

const getScheduleContext = (offer) => {
  const desiredStart = offer.project?.desiredStartDate ? new Date(offer.project.desiredStartDate) : null;
  const desiredDeadline = offer.project?.desiredDeadline ? new Date(offer.project.desiredDeadline) : null;
  const availabilityStart = offer.availabilityStart ? new Date(offer.availabilityStart) : null;
  const durationDays = Number(offer.durationDays) || 0;
  const plannedFinish = availabilityStart && durationDays ? new Date(availabilityStart.getTime() + (durationDays * DAY_MS)) : null;
  const startDeltaDays = desiredStart && availabilityStart ? Math.ceil((availabilityStart - desiredStart) / DAY_MS) : null;
  const deadlineBufferDays = desiredDeadline && plannedFinish ? Math.floor((desiredDeadline - plannedFinish) / DAY_MS) : null;

  let urgency = 'normal';
  if (deadlineBufferDays !== null && deadlineBufferDays < 0) urgency = 'hoch';
  else if (deadlineBufferDays !== null && deadlineBufferDays <= 7) urgency = 'erhoeht';
  else if (startDeltaDays !== null && startDeltaDays > 14) urgency = 'terminlich entspannt, aber spaeter als gewuenscht';

  return {
    desiredStart: formatDate(desiredStart),
    desiredDeadline: formatDate(desiredDeadline),
    availabilityStart: formatDate(availabilityStart),
    durationDays,
    plannedFinish: formatDate(plannedFinish),
    startDeltaDays,
    deadlineBufferDays,
    urgency
  };
};

const getTimingPricePosture = (schedule) => {
  if (schedule.deadlineBufferDays !== null && schedule.deadlineBufferDays < 0) {
    return {
      pressure: 'hoch',
      customerFlex: 0.55,
      contractorFlex: 0.35,
      text: 'Der Terminplan ist sehr eng; ein frueherer oder beschleunigter Ablauf bindet Kapazitaeten und laesst weniger Preisnachlass zu.'
    };
  }

  if (schedule.deadlineBufferDays !== null && schedule.deadlineBufferDays <= 7) {
    return {
      pressure: 'erhoeht',
      customerFlex: 0.7,
      contractorFlex: 0.5,
      text: 'Der Zeitpuffer ist knapp; der Preis bleibt etwas hoeher, weil kurzfristige Koordination und Kapazitaetsbindung teurer sind.'
    };
  }

  if (schedule.startDeltaDays !== null && schedule.startDeltaDays > 14) {
    return {
      pressure: 'frueher gewuenscht',
      customerFlex: 0.65,
      contractorFlex: 0.45,
      text: 'Der gewuenschte Start liegt frueher als die angebotene Verfuegbarkeit; ein Vorziehen waere organisatorisch teurer und reduziert den Rabattspielraum.'
    };
  }

  if (schedule.startDeltaDays !== null && schedule.startDeltaDays < -14) {
    return {
      pressure: 'flexibel',
      customerFlex: 1.12,
      contractorFlex: 1.15,
      text: 'Der Kunde hat zeitlich Spielraum; eine spaetere oder flexiblere Umsetzung kann Planungsluecken fuellen und rechtfertigt etwas mehr Preisnachlass.'
    };
  }

  return {
    pressure: 'normal',
    customerFlex: 1,
    contractorFlex: 1,
    text: 'Der Terminplan wirkt normal; deshalb wird der Preis hauptsaechlich ueber Umfang, Dauer und die bisherigen Gegenangebote ausbalanciert.'
  };
};

const getOfferContext = (offer) => {
  const included = getServiceDescriptions(offer, 'INCLUDED');
  const excluded = getServiceDescriptions(offer, 'EXCLUDED');
  const schedule = getScheduleContext(offer);
  const budget = Number(offer.project?.targetBudget) || 0;
  const budgetDelta = budget > 0 ? Number(offer.amount) - budget : null;
  const budgetDeltaPercent = budget > 0 ? (budgetDelta / budget) * 100 : null;

  return {
    projectTitle: offer.project?.title,
    trade: offer.project?.trade || offer.project?.category,
    projectDescription: offer.project?.description,
    scopeDescription: offer.scopeDescription,
    included,
    excluded,
    includedCount: included.length,
    excludedCount: excluded.length,
    schedule,
    budget,
    budgetDelta,
    budgetDeltaPercent
  };
};

const estimateComplexityFactor = (offer) => {
  const text = [
    offer.scopeDescription,
    offer.project?.description,
    ...getServiceDescriptions(offer, 'INCLUDED')
  ].filter(Boolean).join(' ').toLowerCase();
  const hitCount = SERVICE_COMPLEXITY_TERMS.filter((term) => text.includes(term)).length;
  const includedCount = getServiceDescriptions(offer, 'INCLUDED').length;
  const excludedCount = getServiceDescriptions(offer, 'EXCLUDED').length;
  const includedFactor = Math.min(includedCount * 0.04, 0.24);
  const excludedFactor = Math.min(excludedCount * 0.03, 0.15);

  return clamp(1 + Math.min(hitCount * 0.04, 0.28) + includedFactor - excludedFactor, 0.82, 1.45);
};

const getMarketBenchmark = (offer) => {
  const trade = offer.project?.trade || offer.contractor?.trade || 'default';
  const range = MARKET_HOURLY_RANGES[trade] || MARKET_HOURLY_RANGES.default;
  const durationDays = Math.max(Number(offer.durationDays) || 1, 1);
  const estimatedHours = Math.max(durationDays * 8, 4);
  const complexityFactor = estimateComplexityFactor(offer);
  const marketLow = range.low * estimatedHours * complexityFactor;
  const marketHigh = range.high * estimatedHours * complexityFactor;
  const offerAmount = Number(offer.amount) || 0;

  let position = 'marktueblich';
  let discountPosture = 1;
  let text = 'Das Angebot liegt grob im marktueblichen Korridor fuer Gewerk, Dauer und Leistungsumfang.';

  if (offerAmount > marketHigh * 1.12) {
    position = 'ueber_markt';
    discountPosture = 1.18;
    text = 'Das Angebot wirkt im Vergleich zu Gewerk, Dauer und Leistungsumfang eher ambitioniert; dadurch ist mehr Preisbewegung sachlich begruendbar.';
  } else if (offerAmount < marketLow * 0.88) {
    position = 'unter_markt';
    discountPosture = 0.78;
    text = 'Das Angebot wirkt im Vergleich zu Gewerk, Dauer und Leistungsumfang bereits eher guenstig; dadurch ist weniger Nachlass plausibel.';
  }

  return {
    position,
    discountPosture,
    text,
    basis: {
      trade,
      estimatedHours,
      complexity: complexityFactor > 1.15 ? 'hoch' : complexityFactor < 0.95 ? 'niedrig' : 'normal'
    }
  };
};

const describeContextForText = (offer) => {
  const context = getOfferContext(offer);
  const schedule = context.schedule;
  const market = getMarketBenchmark(offer);
  const includedText = context.included.length ? context.included.slice(0, 3).join(', ') : 'keine detaillierten Inklusivleistungen';
  const excludedText = context.excluded.length ? context.excluded.slice(0, 2).join(', ') : 'keine wesentlichen Ausschluesse';
  const budgetText = context.budget > 0
    ? `Das Projektbudget liegt bei ${formatEuro(context.budget)}, das Angebot liegt ${context.budgetDelta >= 0 ? 'darueber' : 'darunter'} (${formatEuro(Math.abs(context.budgetDelta))}, ${Math.abs(context.budgetDeltaPercent).toFixed(1)}%).`
    : 'Ein verbindliches Projektbudget ist nicht hinterlegt.';
  const timingText = [
    schedule.availabilityStart ? `Start ab ${schedule.availabilityStart}` : 'Starttermin offen',
    schedule.durationDays ? `Dauer ${schedule.durationDays} Tage` : 'Dauer offen',
    schedule.desiredDeadline ? `Deadline ${schedule.desiredDeadline}` : 'keine Deadline',
    schedule.deadlineBufferDays !== null ? `Puffer ${schedule.deadlineBufferDays} Tage` : null
  ].filter(Boolean).join(', ');

  return {
    scope: context.scopeDescription || context.projectDescription || 'Leistungsumfang nur grob beschrieben',
    includedText,
    excludedText,
    budgetText,
    timingText,
    urgency: schedule.urgency,
    marketText: market.text,
    marketPosition: market.position,
    marketComplexity: market.basis.complexity
  };
};

const buildMockAgentResult = ({ session, offer, actorRole, round }) => {
  const startPrice = Number(offer.amount) || 0;
  const progress = Math.min(round / MAX_ROUNDS, 1);
  const concessionStage = round <= 2 ? 'vorsichtig' : round <= 4 ? 'spuerbar' : 'abschlussorientiert';
  const context = describeContextForText(offer);
  const market = getMarketBenchmark(offer);
  const timingPosture = getTimingPricePosture(getScheduleContext(offer));
  const counterPrice = getLastPublicCounterPrice(session.messages || [], actorRole);

  if (actorRole === 'CUSTOMER_AGENT') {
    const target = Number(session.customerTargetPrice);
    const max = Number(session.customerMaxPrice);
    const ideal = Number.isFinite(target) ? target : max;
    const baseProposal = startPrice - ((startPrice - ideal) * progress * timingPosture.customerFlex * market.discountPosture);
    const blendedProposal = counterPrice ? ((baseProposal * 0.65) + (counterPrice * 0.35)) : baseProposal;
    const proposed = clamp(blendedProposal, ideal, max);

    return {
      text: [
        `Der Kundenagent schlaegt ${formatEuro(proposed)} vor.`,
        'Der Vorschlag beruecksichtigt sowohl die bisherige Preisposition des Kunden als auch die zuletzt sichtbare Preisposition des Professionisten, ohne interne Grenzen offenzulegen.',
        `Fachlich wird der Leistungsumfang mit "${context.scope}" bewertet; inkludiert sind ${context.includedText}, waehrend ${context.excludedText} ausgeschlossen bleiben.`,
        `${context.marketText} Die Leistungsdichte wirkt insgesamt ${context.marketComplexity}, was den Preisrahmen entsprechend einordnet.`,
        `Terminlich ist die Lage ${context.urgency}: ${context.timingText}. ${timingPosture.text}`,
        `In Runde ${round} wird ${concessionStage} nachgegeben: Bei frueherem oder dringenderem Bedarf bleibt der Vorschlag bewusst hoeher, bei spaeterer Umsetzung wird mehr Nachlass akzeptiert.`,
        'So bleibt der Preis fuer den Kunden vertretbar, ohne vertrauliche Ziel- oder Grenzwerte preiszugeben.'
      ].join(' '),
      priceProposal: roundMoney(proposed)
    };
  }

  const target = Number(session.contractorTargetPrice);
  const min = Number(session.contractorMinPrice);
  const ideal = Number.isFinite(target) ? target : startPrice;
  const baseProposal = startPrice - ((startPrice - min) * progress * 0.85 * timingPosture.contractorFlex * market.discountPosture);
  const blendedProposal = counterPrice ? ((baseProposal * 0.7) + (counterPrice * 0.3)) : baseProposal;
  const proposed = clamp(blendedProposal, min, ideal);

  return {
    text: [
      `Der Professionistenagent bietet ${formatEuro(proposed)} an.`,
      'Der Vorschlag balanciert die eigene bisherige Preisposition mit der zuletzt sichtbaren Kundenseite, ohne interne Kalkulations- oder Mindestwerte offenzulegen.',
      `Der Preis wird durch den Leistungsumfang "${context.scope}" gestuetzt; enthalten sind ${context.includedText}, nicht enthalten sind ${context.excludedText}.`,
      `${context.marketText} Die Leistungsdichte wirkt insgesamt ${context.marketComplexity}, deshalb wird der Nachlass daran ausgerichtet.`,
      `Terminlich ist die Lage ${context.urgency}: ${context.timingText}. ${timingPosture.text}`,
      `In Runde ${round} ist der Nachlass ${concessionStage}: Wenn es frueher sein soll, bleiben Kapazitaets- und Koordinationskosten staerker eingepreist; bei spaeterer Ausfuehrung kann der Preis etwas weicher werden.`,
      'Damit signalisiert der Professionist Entgegenkommen, schuetzt aber weiterhin Leistung, Dauer, Materialplanung und Terminrisiko.'
    ].join(' '),
    priceProposal: roundMoney(proposed)
  };
};

const parseJsonObject = (text) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const buildPrompt = ({ session, offer, actorRole, round, messages }) => {
  const offerContext = getOfferContext(offer);
  const marketBenchmark = getMarketBenchmark(offer);
  const ownLimits = actorRole === 'CUSTOMER_AGENT'
    ? {
      targetPrice: session.customerTargetPrice,
      maxPrice: session.customerMaxPrice
    }
    : {
      targetPrice: session.contractorTargetPrice,
      minPrice: session.contractorMinPrice
    };

  return [
    'Du bist ein Preisverhandlungsagent fuer ein Hausprojekt in Oesterreich.',
    'Verhandle nur ueber den Preis, nicht ueber Leistungsumfang, Termine oder Vertrage.',
    'Gib ausschliesslich JSON mit den Feldern "text" und "priceProposal" zurueck.',
    'Der Text muss professionell und deutsch sein und 4 bis 6 Saetze enthalten.',
    'Begruende nachvollziehbar, warum genau dieser Preis vorgeschlagen wird.',
    'Beruecksichtige beide sichtbaren Preispositionen: den eigenen aktuellen Vorschlag und den letzten sichtbaren Gegenvorschlag der anderen Seite.',
    'Lege keine internen Zielpreise, Mindestpreise, Maximalpreise, Abstaende zu Limits oder exakte Kalkulationswerte offen.',
    'Der einzige konkrete Betrag im Text soll der neue priceProposal sein.',
    'Gehe konkret auf Leistungsumfang, Inklusivleistungen, Ausschluesse, Projektdauer, Starttermin, Deadline, Dringlichkeit und Projektbudget ein.',
    'Beruecksichtige den Marktpreis-Benchmark qualitativ: unter Markt, marktueblich oder ueber Markt. Nenne keine konkreten Marktpreiswerte, Stundensaetze, Stundenannahmen oder Benchmark-Grenzen.',
    'Wenn das Angebot ueber marktueblich wirkt, darf der Preis staerker Richtung Kunde bewegt werden. Wenn es bereits guenstig wirkt, soll der Preis stabiler bleiben.',
    'Wenn es frueher oder dringender sein soll, erklaere, warum das teurer ist und weniger Rabatt erlaubt.',
    'Wenn eine spaetere oder flexiblere Umsetzung moeglich ist, erklaere, warum dadurch ein etwas niedrigerer Preis realistisch wird.',
    'Wenn Ausschluesse bestehen, nutze sie als Argument fuer mehr Preisspielraum.',
    'Erklaere, ob der Schritt vorsichtig, spuerbar oder abschlussorientiert ist.',
    'Verrate niemals vertrauliche interne Limits der Gegenseite.',
    `Rolle: ${actorRole}`,
    `Runde: ${round} von ${MAX_ROUNDS}`,
    `Aktueller Angebotspreis: ${offer.amount} ${offer.currency || 'EUR'}`,
    `Projekt- und Angebotskontext: ${JSON.stringify(offerContext)}`,
    `Qualitativer Marktpreis-Benchmark: ${JSON.stringify({
      position: marketBenchmark.position,
      leistungsdichte: marketBenchmark.basis.complexity,
      bewertung: marketBenchmark.text
    })}`,
    `Eigene Limits: ${JSON.stringify(ownLimits)}`,
    `Oeffentlicher Verlauf: ${JSON.stringify(messages.map((message) => ({
      role: message.role,
      text: message.text,
      priceProposal: message.priceProposal
    })))}`
  ].join('\n');
};

const buildOpenAiAgentResult = async (prompt) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4.1-mini',
      input: prompt
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  const outputText = data.output_text || data.output?.flatMap((item) => item.content || [])
    .map((item) => item.text || '')
    .join('\n');
  const parsed = parseJsonObject(outputText || '');
  if (!parsed) return null;

  return {
    text: String(parsed.text || '').slice(0, 1200),
    priceProposal: Number(parsed.priceProposal)
  };
};

const buildGeminiAgentResult = async (prompt) => {
  const model = process.env.AI_MODEL || 'gemini-1.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  const outputText = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('\n');
  const parsed = parseJsonObject(outputText || '');
  if (!parsed) return null;

  return {
    text: String(parsed.text || '').slice(0, 1200),
    priceProposal: Number(parsed.priceProposal)
  };
};

const buildLlmAgentResult = async ({ session, offer, actorRole, round, messages }) => {
  const provider = process.env.AI_PROVIDER;
  const prompt = buildPrompt({ session, offer, actorRole, round, messages });

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return buildOpenAiAgentResult(prompt);
  }

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return buildGeminiAgentResult(prompt);
  }

  return null;
};

const sanitizeAgentResult = ({ result, session, offer, actorRole, round }) => {
  const fallback = buildMockAgentResult({
    session,
    offer,
    actorRole,
    round
  });

  const text = result?.text || fallback.text;
  const rawPrice = Number(result?.priceProposal);

  if (actorRole === 'CUSTOMER_AGENT') {
    const min = Number(session.customerTargetPrice);
    const max = Number(session.customerMaxPrice);
    return {
      text,
      priceProposal: roundMoney(clamp(Number.isFinite(rawPrice) ? rawPrice : fallback.priceProposal, min, max))
    };
  }

  const min = Number(session.contractorMinPrice);
  const max = Number(session.contractorTargetPrice || offer.amount);
  return {
    text,
    priceProposal: roundMoney(clamp(Number.isFinite(rawPrice) ? rawPrice : fallback.priceProposal, min, max))
  };
};

const createAgentMessage = async ({ session, offer, actorRole, round, messages }) => {
  const llmResult = await buildLlmAgentResult({ session, offer, actorRole, round, messages }).catch(() => null);
  const result = llmResult || buildMockAgentResult({ session, offer, actorRole, round });
  return sanitizeAgentResult({ result, session, offer, actorRole, round });
};

const evaluateDeal = (session, messages) => {
  const customerProposal = getLastProposal(messages, 'CUSTOMER_AGENT');
  const contractorProposal = getLastProposal(messages, 'CONTRACTOR_AGENT');
  if (!customerProposal || !contractorProposal) return null;

  const customerMax = Number(session.customerMaxPrice);
  const contractorMin = Number(session.contractorMinPrice);
  const buyerPrice = Number(customerProposal.priceProposal);
  const sellerPrice = Number(contractorProposal.priceProposal);

  if (sellerPrice <= customerMax && buyerPrice >= contractorMin) {
    return roundMoney((Math.max(contractorMin, sellerPrice) + Math.min(customerMax, buyerPrice)) / 2);
  }

  if (contractorMin <= customerMax && messages.length >= 2) {
    return roundMoney((contractorMin + customerMax) / 2);
  }

  return null;
};

module.exports = {
  MAX_ROUNDS,
  createAgentMessage,
  evaluateDeal
};
