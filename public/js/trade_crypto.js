
    // Tab switching
    function switchTab(tab) {
        document.querySelectorAll('.trade-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.trade-form').forEach(f => f.classList.remove('active'));
        
        document.querySelector('.trade-tab.' + tab).classList.add('active');
        document.getElementById(tab + 'Form').classList.add('active');
    }

    // Chart
    const ctx = document.getElementById('tradingChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'BTC',
                data: [],
                borderColor: '#8b5cf6',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: {
                    display: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#52525b',
                        callback: v => '$' + v.toLocaleString()
                    }
                }
            }
        }
    });

    // Socket
    if (typeof io !== 'undefined') {
        const socket = io();
        
        socket.on('btcPrice', (data) => {
            if (!data || !data.price) return;
            
            const price = data.price.toLocaleString();
            const change = data.change24h ? data.change24h.toFixed(2) : '0.00';
            const isPositive = data.change24h >= 0;
            
            document.getElementById('chartPrice').textContent = '$' + price;
            document.getElementById('panelPrice').textContent = '$' + price;
            
            const changeEl = document.getElementById('chartChange');
            changeEl.textContent = (isPositive ? '+' : '') + change + '%';
            changeEl.style.color = isPositive ? '#22c55e' : '#ef4444';
            
            // Update chart (max 50 points)
            if (chart.data.labels.length > 50) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            chart.data.labels.push(chart.data.labels.length);
            chart.data.datasets[0].data.push(data.price);
            chart.update('none');
        });
    }
