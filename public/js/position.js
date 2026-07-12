
    // Auto-refresh prices every 3 seconds
    let priceRefreshFailCount = 0;
    const MAX_SILENT_FAILS = 3; // stop hammering console/endpoint after repeated 404s

    async function refreshPrices() {
        try {
            const response = await fetch('/trading/api/prices');

            // Guard: endpoint missing or erroring returns an HTML page, not JSON.
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok || !contentType.includes('application/json')) {
                throw new Error(`Prices endpoint returned ${response.status} (${contentType || 'no content-type'})`);
            }

            const prices = await response.json();
            priceRefreshFailCount = 0;
            document.getElementById('staleBanner').classList.remove('visible');

            prices.forEach(p => {
                const cells = document.querySelectorAll(`.current-price[data-symbol="${p.symbol}"]`);
                cells.forEach(cell => {
                    const oldPrice = parseFloat(cell.textContent);
                    const newPrice = parseFloat(p.bid);
                    const direction = cell.getAttribute('data-direction');

                    cell.textContent = newPrice.toFixed(5);

                    // Flash color on price change
                    if (newPrice > oldPrice) {
                        cell.style.color = '#2dd4a7';
                    } else if (newPrice < oldPrice) {
                        cell.style.color = '#ef4444';
                    }
                    setTimeout(() => cell.style.color = '', 800);
                });
            });
        } catch (err) {
            priceRefreshFailCount++;
            if (priceRefreshFailCount <= MAX_SILENT_FAILS) {
                console.warn('Price refresh failed:', err.message);
            }
            if (priceRefreshFailCount === MAX_SILENT_FAILS) {
                console.warn('Suppressing further price-refresh error logs; endpoint /trading/api/prices still unavailable.');
                document.getElementById('staleBanner').classList.add('visible');
            }
        }
    }

    // Refresh every 3 seconds
    setInterval(refreshPrices, 3000);

    // Initial refresh
    refreshPrices();
