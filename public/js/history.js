
    function switchView(view) {
        const txView = document.getElementById('transactionsView');
        const tradeView = document.getElementById('tradingView');
        const btnTx = document.getElementById('btnTransactions');
        const btnTrade = document.getElementById('btnTrading');
        
        if (view === 'transactions') {
            txView.classList.remove('hidden');
            tradeView.classList.add('hidden');
            btnTx.classList.add('active');
            btnTrade.classList.remove('active');
            history.replaceState(null, '', '/transactions/history?view=transactions');
        } else {
            txView.classList.add('hidden');
            tradeView.classList.remove('hidden');
            btnTx.classList.remove('active');
            btnTrade.classList.add('active');
            history.replaceState(null, '', '/transactions/history?view=trading');
        }
    }
    
    function filterTransactions() {
        const type = document.getElementById('txTypeFilter').value;
        const status = document.getElementById('txStatusFilter').value;
        const rows = document.querySelectorAll('#transactionsTable tbody tr');
        
        rows.forEach(row => {
            if (row.classList.contains('empty-state')) return;
            const rowType = row.getAttribute('data-type');
            const rowStatus = row.getAttribute('data-status');
            const show = (type === 'all' || rowType === type) && (status === 'all' || rowStatus === status);
            row.style.display = show ? '' : 'none';
        });
    }
    
    function filterTrades() {
        const side = document.getElementById('tradeSideFilter').value;
        const outcome = document.getElementById('tradeOutcomeFilter').value;
        const rows = document.querySelectorAll('#tradingTable tbody tr');
        
        rows.forEach(row => {
            if (row.classList.contains('empty-state')) return;
            const rowSide = row.getAttribute('data-side');
            const rowOutcome = row.getAttribute('data-outcome');
            const show = (side === 'all' || rowSide === side) && (outcome === 'all' || rowOutcome === outcome);
            row.style.display = show ? '' : 'none';
        });
    }
