
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileBtn  = document.getElementById('mobileMenuBtn');
        const closeBtn   = document.getElementById('closeMenuBtn');
        const overlay    = document.getElementById('mobileOverlay');

        function openMobileMenu()  { mobileMenu.classList.add('active');    document.body.style.overflow = 'hidden'; }
        function closeMobileMenu() { mobileMenu.classList.remove('active'); document.body.style.overflow = ''; }

        mobileBtn.addEventListener('click', openMobileMenu);
        closeBtn.addEventListener('click',  closeMobileMenu);
        overlay.addEventListener('click',   closeMobileMenu);
        document.querySelectorAll('.mobile-link').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
    

    
document.addEventListener('DOMContentLoaded', function () {
    const wrap = document.getElementById('netToastWrap');
    if (!wrap) {
        console.warn('netToastWrap not found in DOM');
        return;
    }

    let currentToast = null;
    let hideTimer = null;

    function showToast(type, message, autoHideMs) {
        if (currentToast) {
            currentToast.remove();
            currentToast = null;
        }
        clearTimeout(hideTimer);

        const toast = document.createElement('div');
        toast.className = 'net-toast ' + type;
        toast.innerHTML = '<span class="net-dot"></span><span>' + message + '</span>';
        wrap.appendChild(toast);
        currentToast = toast;

        requestAnimationFrame(() => toast.classList.add('show'));

        if (autoHideMs) {
            hideTimer = setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                    if (currentToast === toast) currentToast = null;
                }, 300);
            }, autoHideMs);
        }
    }

    async function pingCheck() {
        const start = performance.now();
        try {
            const res = await fetch('/ping', { method: 'GET', cache: 'no-store' });
            const elapsed = performance.now() - start;
            if (!res.ok) throw new Error('bad status');
            return elapsed > 900 ? 'slow' : 'online';
        } catch (e) {
            return 'offline';
        }
    }

    async function handleStatusChange() {
        if (!navigator.onLine) {
            showToast('offline', 'You are offline', null);
            return;
        }
        const result = await pingCheck();
        if (result === 'offline') {
            showToast('offline', 'You are offline', null);
        } else if (result === 'slow') {
            showToast('slow', 'Slow connection', 4000);
        } else {
            showToast('online', 'Back online', 3000);
        }
    }

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', () => showToast('offline', 'You are offline', null));

    console.log('net toast script initialized');

    setInterval(async () => {
        if (!navigator.onLine) return;
        const result = await pingCheck();
        if (result === 'slow') showToast('slow', 'Slow connection', 4000);
        if (result === 'offline') showToast('offline', 'You are offline', null);
    }, 15000);
});