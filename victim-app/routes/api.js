/**
 * API Routes
 * 
 * RESTful endpoints for the victim application.
 * These endpoints are common attack targets.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    console.log('[FILE_UPLOAD_ATTEMPT]', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      ip: req.ip
    });
    cb(null, true);
  }
});

// Comment submission endpoint
router.post('/comment', (req, res) => {
  const { postId, content, author } = req.body;
  
  console.log('[COMMENT_SUBMISSION]', {
    postId,
    contentLength: (content || '').length,
    author,
    ip: req.ip
  });
  
  // Echo back comment (vulnerable to XSS in real scenario)
  res.json({
    success: true,
    comment: {
      id: Date.now(),
      postId,
      content,
      author: author || 'Anonymous',
      createdAt: new Date().toISOString()
    },
    message: 'Comment submitted successfully'
  });
});

// Search API endpoint
router.get('/search', (req, res) => {
  const { q, category, limit } = req.query;
  
  console.log('[API_SEARCH]', { query: q, category, limit, ip: req.ip });
  
  // Simulated search response
  res.json({
    success: true,
    query: q,
    results: [
      { id: 1, title: `Result for "${q}"`, type: category || 'general' },
      { id: 2, title: 'Related item', type: category || 'general' }
    ],
    total: 2
  });
});

// File upload endpoint
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }
  
  console.log('[FILE_UPLOADED]', {
    filename: req.file.filename,
    size: req.file.size,
    mimeType: req.file.mimetype,
    ip: req.ip
  });
  
  res.json({
    success: true,
    file: {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    },
    message: 'File uploaded successfully'
  });
});

// User lookup endpoint (vulnerable to enumeration)
router.get('/user/:id', (req, res) => {
  const { id } = req.params;
  
  console.log('[USER_LOOKUP]', { userId: id, ip: req.ip });
  
  // Simulated user data
  res.json({
    success: true,
    user: {
      id,
      name: 'John Doe',
      email: 'j***@example.com',
      memberSince: '2023-01-15'
    }
  });
});

// Transaction endpoint (sensitive operation)
router.post('/transfer', (req, res) => {
  const { fromAccount, toAccount, amount, description } = req.body;
  
  console.log('[TRANSFER_ATTEMPT]', {
    fromAccount,
    toAccount,
    amount,
    ip: req.ip
  });
  
  // Always deny (simulated)
  res.json({
    success: false,
    message: 'Transaction requires additional verification',
    referenceId: 'TXN-' + Date.now()
  });
});

// Newsletter subscription
router.post('/subscribe', (req, res) => {
  const { email } = req.body;
  
  console.log('[NEWSLETTER_SUBSCRIBE]', { email, ip: req.ip });
  
  res.json({
    success: true,
    message: 'Successfully subscribed to newsletter',
    email
  });
});

// Feedback endpoint
router.post('/feedback', (req, res) => {
  const { rating, feedback, page } = req.body;
  
  console.log('[FEEDBACK]', {
    rating,
    feedbackLength: (feedback || '').length,
    page,
    ip: req.ip
  });
  
  res.json({
    success: true,
    message: 'Thank you for your feedback!'
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    idsIntegration: req.idsResult ? 'connected' : 'unknown'
  });
});

module.exports = router;
