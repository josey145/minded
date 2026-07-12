{/* <script>
const USER_CURRENCY   = '<%= dc %>';
const USER_BALANCE    = <%= parseFloat(displayBalance || 0) %>;  // Now in user's currency
const CURRENCY_SYMBOL = '<%= sym %>';

// ── Live rate for preview (user's currency → USD) ─────────────────────────
let userToUsdRate = null;

(async function () {
    if (USER_CURRENCY === 'USD') { userToUsdRate = 1; return; }
    try {
        const res  = await fetch('/api/rate?from=' + USER_CURRENCY + '&to=USD');
        const data = await res.json();
        if (data && data.rate) {
            userToUsdRate = parseFloat(data.rate);
            updateConvertedDisplay();
        }
    } catch (e) {
        console.warn('Could not fetch live rate for preview:', e);
    }
})();

// ── Amount input → converted display ─────────────────────────────────────
const withdrawAmountEl  = document.getElementById('withdrawAmount');
const convertedDisplay  = document.getElementById('convertedDisplay');

function updateConvertedDisplay() {
    if (!convertedDisplay) return;
    const userAmount = parseFloat(withdrawAmountEl?.value) || 0;
    if (!userToUsdRate || userAmount <= 0) {
        convertedDisplay.textContent = '≈ —';
        return;
    }
    const usdAmount = userAmount * userToUsdRate;
    convertedDisplay.textContent = '≈ $'
        + usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        + ' USD (stored in USD)';
}

withdrawAmountEl?.addEventListener('input', updateConvertedDisplay);

// ── Method select → update labels / hints ─────────────────────────────────
const methodSelect    = document.getElementById('methodSelect');
const accountLabel    = document.getElementById('accountLabel');
const accountInput    = document.getElementById('accountInput');
const methodHint      = document.getElementById('methodHint');
const cryptoTypeInput = document.getElementById('cryptoTypeInput');

methodSelect.addEventListener('change', function () {
    const opt        = this.options[this.selectedIndex];
    const isCrypto   = this.value === 'crypto';
    const cryptoCode = opt.getAttribute('data-crypto') || '';
    const label      = opt.text.trim();

    // Set hidden crypto_type field
    cryptoTypeInput.value = isCrypto ? cryptoCode : '';

    if (isCrypto) {
        accountLabel.innerHTML      = `<i class="fas fa-wallet"></i> ${label} Wallet Address`;
        accountInput.placeholder    = `Paste your ${label} wallet address here...`;
        methodHint.textContent      = 'Ensure the network matches your wallet (e.g. USDT must be TRC20).';
        methodHint.style.color      = '#f59e0b';
    } else {
        accountLabel.innerHTML      = `<i class="fas fa-university"></i> Account Details — ${label}`;
        accountInput.placeholder    = 'Full Name:\nAccount Number / IBAN:\nBank Name:\nBranch (if required):';
        methodHint.textContent      = 'Bank transfers take 1–3 business days to process.';
        methodHint.style.color      = '#8b5cf6';
    }
});

// ── Form validation ────────────────────────────────────────────────────────
document.getElementById('withdrawForm').addEventListener('submit', function (e) {
    const method = methodSelect.value;
    if (!method) {
        e.preventDefault();
        alert('Please select a withdrawal method.');
        return;
    }

    const userAmount = parseFloat(withdrawAmountEl.value);
    if (!userAmount || userAmount <= 0) {
        e.preventDefault();
        alert('Please enter a valid amount.');
        return;
    }

    // Check against user's currency balance
    if (userAmount > USER_BALANCE) {
        e.preventDefault();
        alert('Insufficient balance. Your balance is '
            + CURRENCY_SYMBOL + USER_BALANCE.toLocaleString('en-US', { minimumFractionDigits: 2 })
            + ' ' + USER_CURRENCY
            + ' but you requested '
            + CURRENCY_SYMBOL + userAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })
            + ' ' + USER_CURRENCY + '.'
        );
    }
}); */}
