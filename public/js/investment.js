
// ── Constants injected from server ──────────────────────────────────────────
const USER_CURRENCY    = '<%= dc %>';           // e.g. 'PHP', 'EUR', 'NGN'
const CURRENCY_SYMBOL  = '<%= currSymbol %>';   // e.g. '₱', '€', '₦'

// Exchange rate: USD → user currency (fetched async, see below)
// We use this only for the live preview; the backend does the authoritative conversion.
let usdToUserRate = null;

// Fetch the live rate once on page load so the modal preview is accurate
(async function fetchRate() {
    if (USER_CURRENCY === 'USD') { usdToUserRate = 1; return; }
    try {
        const res  = await fetch('/api/rate?from=USD&to=' + USER_CURRENCY);
        const data = await res.json();
        if (data && data.rate) usdToUserRate = parseFloat(data.rate);
    } catch (e) {
        console.warn('Could not fetch live rate for preview:', e);
    }
})();

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(amount) {
    const n = parseFloat(amount) || 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtUser(amount) {
    const n = parseFloat(amount) || 0;
    if (Math.abs(n) >= 1000) {
        return CURRENCY_SYMBOL + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return CURRENCY_SYMBOL + n.toFixed(2);
}

// ── Plan state ───────────────────────────────────────────────────────────────
let currentPlan = null;

// ── Open / Close modals ──────────────────────────────────────────────────────

function openInvestModal(id, name, min, max, dailyReturn, duration, color, icon) {
    currentPlan = { id, name, min: parseFloat(min), max: parseFloat(max), dailyReturn: parseFloat(dailyReturn), duration: parseInt(duration), color };

    document.getElementById('planId').value              = id;
    document.getElementById('modalTitle').textContent    = 'Invest in ' + name;
    document.getElementById('minAmount').textContent     = parseFloat(min).toFixed(0);
    document.getElementById('maxAmount').textContent     = parseFloat(max).toFixed(0);
    document.getElementById('modalIcon').style.background = color;
    document.getElementById('modalIcon').innerHTML       = '<i class="' + icon + '"></i>';

    const amountInput = document.getElementById('investAmount');
    amountInput.min         = min;
    amountInput.max         = max;
    amountInput.placeholder = 'Min $' + parseFloat(min).toFixed(0) + ' – Max $' + parseFloat(max).toFixed(0);
    amountInput.value       = '';

    togglePayment('balance');
    document.querySelector('input[name="payment_method"][value="balance"]').checked = true;

    updatePreview();
    document.getElementById('investModal').classList.add('active');
}

function openFundModal()  { document.getElementById('fundModal').classList.add('active'); }
function closeModal()     { document.getElementById('investModal').classList.remove('active'); document.getElementById('investForm').reset(); togglePayment('balance'); }
function closeFundModal() { document.getElementById('fundModal').classList.remove('active'); }
function scrollToPlans()  { document.getElementById('plansSection').scrollIntoView({ behavior: 'smooth' }); }

// ── Invest modal: toggle payment sections ────────────────────────────────────

function togglePayment(method) {
    document.getElementById('investCardDetails').style.display   = method === 'card'   ? 'block' : 'none';
    document.getElementById('investCryptoSelection').style.display = method === 'crypto' ? 'block' : 'none';

    const cardRequired = method === 'card';
    ['cardNumber','cardExpiry','cardCvc','cardName'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.required = cardRequired;
    });

    // Show converted preview only when paying with balance and currency ≠ USD
    const preview = document.getElementById('convertedPreview');
    if (preview) preview.style.display = (method === 'balance' && USER_CURRENCY !== 'USD') ? 'block' : 'none';

    document.querySelectorAll('#investModal .payment-check').forEach(icon => icon.style.opacity = '0');
    const sel = document.querySelector('#investModal input[name="payment_method"][value="' + method + '"]');
    if (sel) sel.closest('.payment-option').querySelector('.payment-check').style.opacity = '1';

    updatePreview();
}

// ── Fund modal: toggle payment sections ──────────────────────────────────────

function toggleFundPayment(method) {
    document.getElementById('fundCardDetails').style.display   = method === 'card'   ? 'block' : 'none';
    document.getElementById('fundCryptoSelection').style.display = method === 'crypto' ? 'block' : 'none';

    document.querySelectorAll('#fundModal .fund-check').forEach(icon => icon.style.opacity = '0');
    const sel = document.querySelector('#fundModal input[name="payment_method"][value="' + method + '"]');
    if (sel) sel.closest('.payment-option').querySelector('.fund-check').style.opacity = '1';

    // Rename fund crypto inputs so backend receives crypto_type
    document.querySelectorAll('#fundCryptoSelection input[name="fund_crypto_type"]').forEach(el => {
        el.name = 'crypto_type';
    });
}

// ── Card number / expiry formatting ─────────────────────────────────────────

function formatCardNumber(input) {
    let v = input.value.replace(/\D/g, '');
    v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
    input.value = v;
}
function formatExpiry(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2, 4);
    input.value = v;
}

document.getElementById('cardNumber')?.addEventListener('input',     function() { formatCardNumber(this); });
document.getElementById('cardExpiry')?.addEventListener('input',     function() { formatExpiry(this); });
document.getElementById('fundCardNumber')?.addEventListener('input', function() { formatCardNumber(this); });
document.getElementById('fundCardExpiry')?.addEventListener('input', function() { formatExpiry(this); });

// ── Preview calculator ───────────────────────────────────────────────────────

function updatePreview() {
    if (!currentPlan) return;
    const amount = parseFloat(document.getElementById('investAmount').value) || 0;
    const daily  = (amount * currentPlan.dailyReturn) / 100;
    const total  = daily * currentPlan.duration;

    document.getElementById('previewDaily').textContent    = fmtUSD(daily);
    document.getElementById('previewDuration').textContent = currentPlan.duration + ' days';
    document.getElementById('previewTotal').textContent    = fmtUSD(total);

    // Converted balance deduction preview (only when paying with balance in non-USD)
    const deductEl   = document.getElementById('previewDeduction');
    const convertEl  = document.getElementById('convertedAmount');
    const selectedMethod = document.querySelector('#investModal input[name="payment_method"]:checked')?.value;

    if (USER_CURRENCY !== 'USD' && selectedMethod === 'balance') {
        if (usdToUserRate && amount > 0) {
            const converted = amount * usdToUserRate;
            if (deductEl)  deductEl.textContent  = fmtUser(converted);
            if (convertEl) convertEl.textContent  = fmtUser(converted);
        } else {
            if (deductEl)  deductEl.textContent  = '—';
            if (convertEl) convertEl.textContent  = '...';
        }
    } else {
        if (deductEl)  deductEl.textContent = fmtUSD(amount);
    }
}

document.getElementById('investAmount').addEventListener('input', updatePreview);

// ── Close on backdrop click ──────────────────────────────────────────────────

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });
});

// ── Form validation ──────────────────────────────────────────────────────────

document.getElementById('investForm').addEventListener('submit', function(e) {
    const amount = parseFloat(document.getElementById('investAmount').value);
    if (currentPlan && (amount < currentPlan.min || amount > currentPlan.max)) {
        e.preventDefault();
        alert('Amount must be between $' + currentPlan.min.toFixed(0) + ' and $' + currentPlan.max.toFixed(0));
    }
});

