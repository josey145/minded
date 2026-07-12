
  if (typeof io !== 'undefined') {
    const socket = io();

    socket.on('btcPrice', (data) => {
      if (!data || !data.price) return;

      const priceEl = document.getElementById('btcPrice');
      const changeEl = document.getElementById('btcChange');
      if (priceEl) priceEl.textContent = '$' + data.price.toLocaleString();
      const pct = data.change24h ? data.change24h.toFixed(2) : '0.00';
      const isPositive = data.change24h >= 0;
      if (changeEl) {
        changeEl.className = 'ticker-widget-change ' + (isPositive ? 'up' : 'down');
        changeEl.innerHTML = '<i class="fas fa-arrow-' + (isPositive ? 'up' : 'down') + '"></i> ' + Math.abs(pct) + '%';
      }

      const tickerBtcPrice = document.getElementById('ticker-btc-price');
      const tickerBtcChange = document.getElementById('ticker-btc-change');
      if (tickerBtcPrice) tickerBtcPrice.textContent = '$' + data.price.toLocaleString();
      if (tickerBtcChange) {
        tickerBtcChange.className = 'ticker-change ' + (isPositive ? 'up' : 'down');
        tickerBtcChange.innerHTML = '<i class="fas fa-arrow-' + (isPositive ? 'up' : 'down') + '"></i> ' + (isPositive ? '+' : '') + pct + '%';
      }
    });

    socket.on('ethPrice', (data) => {
      if (!data || !data.price) return;
      const el = document.getElementById('ticker-eth-price');
      const ch = document.getElementById('ticker-eth-change');
      if (el) el.textContent = '$' + data.price.toLocaleString();
      if (ch && data.change24h !== undefined) {
        const isPos = data.change24h >= 0;
        ch.className = 'ticker-change ' + (isPos ? 'up' : 'down');
        ch.innerHTML = '<i class="fas fa-arrow-' + (isPos ? 'up' : 'down') + '"></i> ' + (isPos ? '+' : '') + data.change24h.toFixed(2) + '%';
      }
    });
  }

  function dismissAlert(alertId) {
    const alert = document.getElementById('alert-' + alertId);
    if (alert) {
      alert.style.opacity = '0';
      alert.style.transform = 'translateX(20px)';
      alert.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        alert.remove();
        const dismissed = JSON.parse(sessionStorage.getItem('dismissedAlerts') || '[]');
        dismissed.push(alertId);
        sessionStorage.setItem('dismissedAlerts', JSON.stringify(dismissed));
      }, 300);
    }
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  document.addEventListener('DOMContentLoaded', () => {
    const dismissed = JSON.parse(sessionStorage.getItem('dismissedAlerts') || '[]');
    dismissed.forEach(id => {
      const alert = document.getElementById('alert-' + id);
      if (alert) alert.remove();
    });
  });
