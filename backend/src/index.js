const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/property');
const roomRoutes = require('./routes/room');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/properties/:propertyId/rooms', roomRoutes);
app.use('/api/rooms', roomRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
