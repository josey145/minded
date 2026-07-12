
    let selectedPair = null;
    let currentDirection = 'buy';
    let tvWidget = null;

    function initChart(symbol) {
        if (tvWidget) {
            tvWidget.remove();
        }

        tvWidget = new TradingView.widget({
            "width": "100%",
            "height": 400,
            "symbol": "FX:" + (symbol || "EURUSD"),
            "interval": "15",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#f1f3f6",
            "enable_publishing": false,
            "hide_top_toolbar": true,
            "hide_legend": true,
            "save_image": false,
            "container_id": "tradingview_chart"
        });
    }

    function selectPair(id, symbol, name, bid, ask) {
        selectedPair = { id, symbol, name, bid, ask };

        document.getElementById('formPairId').value = id;
        document.getElementById('selectedPairDisplay').textContent = symbol;
        document.getElementById('chartPairName').textContent = name;
        document.getElementById('chartPairSymbol').textContent = symbol;
        document.getElementById('chartPrice').textContent = bid.toFixed(5);

        document.getElementById('submitBtn').disabled = false;

        document.querySelectorAll('.pair-card').forEach(c => c.classList.remove('active'));
        event.currentTarget.classList.add('active');

        initChart(symbol);

        calculateMargin();
    }

    function setDirection(dir) {
        currentDirection = dir;
        document.getElementById('directionInput').value = dir;

        document.querySelectorAll('.direction-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.direction-tab.' + dir).classList.add('active');

        const btn = document.getElementById('submitBtn');
        btn.className = 'btn-submit ' + dir;
        btn.textContent = 'Open ' + dir.toUpperCase() + ' Position';
    }

    function calculateMargin() {
        if (!selectedPair) return;

        const lotSize = parseFloat(document.getElementById('lotSize').value);
        const leverage = parseInt(document.getElementById('leverage').value);
        const contractSize = lotSize * 100000;
        const marginRequired = contractSize / leverage;
        const pipValue = lotSize * 10;

        document.getElementById('contractSize').textContent = contractSize.toLocaleString();
        document.getElementById('pipValue').textContent = '$' + pipValue.toFixed(2);
        document.getElementById('marginRequired').textContent = '$' + marginRequired.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const minEl = document.getElementById('minTrade');
        if (marginRequired < 10) {
            minEl.textContent = 'Below $10! Increase size';
            minEl.className = 'calc-value warning';
        } else {
            minEl.textContent = '$10.00 ✓';
            minEl.className = 'calc-value success';
        }
    }

    // ==================== MODAL FUNCTIONS ====================
    function openCreateModal() {
        document.getElementById('createAccountModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeCreateModal() {
        document.getElementById('createAccountModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    function setModalType(type) {
        document.getElementById('modalAccountType').value = type;

        document.querySelectorAll('.modal-type-option').forEach(opt => {
            opt.classList.remove('active', 'real', 'demo');
        });
        document.querySelector(`.modal-type-option[data-type="${type}"]`).classList.add('active', type);

        const btn = document.getElementById('modalSubmitBtn');
        const balanceGroup = document.getElementById('modalBalanceGroup');

        if (type === 'real') {
            btn.className = 'modal-btn-submit real';
            btn.textContent = 'Create Real Account';
            balanceGroup.style.display = 'block';
        } else {
            btn.className = 'modal-btn-submit demo';
            btn.textContent = 'Create Demo Account';
            balanceGroup.style.display = 'none';
        }
    }

    // Close modal on overlay click
    document.getElementById('createAccountModal').addEventListener('click', function(e) {
        if (e.target === this) closeCreateModal();
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeCreateModal();
    });

    if (typeof io !== 'undefined') {
        const socket = io();

        socket.on('forex_price', (data) => {
            const bidEl = document.getElementById('bid-' + data.symbol);
            const askEl = document.getElementById('ask-' + data.symbol);

            if (bidEl) bidEl.textContent = data.bid.toFixed(5);
            if (askEl) askEl.textContent = data.ask.toFixed(5);

            if (selectedPair && selectedPair.symbol === data.symbol) {
                document.getElementById('chartPrice').textContent = data.bid.toFixed(5);
            }
        });

        socket.on('position_update', (data) => {
            location.reload();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initChart('EURUSD');
    });

