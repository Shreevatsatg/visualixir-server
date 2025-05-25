const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.frontend_url || 'http://localhost:5173';

// Import routes
const animateRoutes = require('./routes/animate');

// Middleware
const corsOptions = {
  origin: FRONTEND_URL,
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Serve videos from the public/videos directory
app.use('/videos', express.static(path.join(__dirname, 'public', 'videos')));

// Also serve directly from public directory for flexibility
app.use(express.static(path.join(__dirname, 'public')));

// Use routes
app.use('/api', animateRoutes);

// API endpoint to create animation from text


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
