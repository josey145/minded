const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { title: 'TADAWU LX - Trade Successfully & Safely' });
});

router.get('/about', (req, res) => {
    res.render('about', { title: 'About Us - TADAWU LX' });
});

router.get('/faq', (req, res) => {
    res.render('faq', { title: 'FAQ - TADAWU LX' });
});

router.get('/terms', (req, res) => {
    res.render('terms', { title: 'Terms of Service - TADAWU LX' });
});

// Lightweight network health check — no auth required, must stay public
// since it needs to respond even for logged-out users / on any page
router.get('/ping', (req, res) => {
    res.sendStatus(200);
});

module.exports = router;