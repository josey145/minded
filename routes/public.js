const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { title: 'Maximum - Trade Successfully & Safely' });
});

router.get('/about', (req, res) => {
    res.render('about', { title: 'About Us - Maximum' });
});

router.get('/faq', (req, res) => {
    res.render('faq', { title: 'FAQ - Maximum' });
});

router.get('/terms', (req, res) => {
    res.render('terms', { title: 'Terms of Service - Maximum' });
});

// Lightweight network health check — no auth required, must stay public
// since it needs to respond even for logged-out users / on any page
router.get('/ping', (req, res) => {
    res.sendStatus(200);
});

module.exports = router;