const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/property');
const roomRoutes = require('./routes/room');
const contractorRoutes = require('./routes/contractor');
const projectRoutes = require('./routes/project');
const offerRoutes = require('./routes/offer');
const negotiationRoutes = require('./routes/negotiation');
const chatRoutes = require('./routes/chat');
const municipalTaxRoutes = require('./routes/municipalTax');
const insuranceRoutes = require('./routes/insurance');
const documentRoutes = require('./routes/document');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/properties/:propertyId/rooms', roomRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/negotiations', negotiationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/municipal-taxes', municipalTaxRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/documents', documentRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
