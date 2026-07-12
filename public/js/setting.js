
// Password strength indicator
document.getElementById('newPass')?.addEventListener('input', function() {
    const bar = document.getElementById('strengthBar');
    const val = this.value;
    let score = 0;
    if (val.length >= 8)  score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#22c55e'];
    const widths = ['0%', '20%', '40%', '65%', '85%', '100%'];
    bar.style.width      = widths[score];
    bar.style.background = colors[score];
});
