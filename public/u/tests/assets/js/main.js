document.addEventListener('DOMContentLoaded', () => {
    const themeSwitcher = document.getElementById('theme-switcher');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');

    // --- Theme Switcher --- //
    const applyTheme = (theme) => {
        // Giscus
        let iframe = document.querySelector('iframe.giscus-frame');
        if (iframe) {
            iframe.contentWindow.postMessage(
                {
                    giscus: {
                        setConfig: {
                            theme: theme,
                        },
                    },
                },
                'https://giscus.app'
            );
        }
        
        if (theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            if(themeSwitcher) themeSwitcher.textContent = '☀️';
        } else {
            document.body.removeAttribute('data-theme');
            if(themeSwitcher) themeSwitcher.textContent = '🌙';
        }
    };

    const currentTheme = localStorage.getItem('theme');
    applyTheme(currentTheme);

    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            let theme = document.body.getAttribute('data-theme');
            if (theme === 'dark') {
                localStorage.removeItem('theme');
                applyTheme('light');
            } else {
                localStorage.setItem('theme', 'dark');
                applyTheme('dark');
            }
        });
    }

    // --- Hamburger Menu --- //
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            if (navLinks.classList.contains('active')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                    menu.previousElementSibling.classList.remove('open');
                });
            }
        });
    }

    // --- Dropdown Menu Toggle (using Event Delegation) --- //
    if (navLinks) {
        navLinks.addEventListener('click', (e) => {
            const toggle = e.target.closest('.dropdown-toggle');
            if (toggle && window.getComputedStyle(hamburger).display === 'block') {
                e.preventDefault();
                const dropdownMenu = toggle.nextElementSibling;

                // Close other open dropdowns
                navLinks.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    if (menu !== dropdownMenu) {
                        menu.classList.remove('show');
                        menu.previousElementSibling.classList.remove('open');
                    }
                });

                // Toggle the current dropdown
                dropdownMenu.classList.toggle('show');
                toggle.classList.toggle('open');
            }
        });
    }

    // --- Close Menus When Clicking Outside --- //
    document.addEventListener('click', (e) => {
        if (navLinks && navLinks.classList.contains('active') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
            navLinks.classList.remove('active');
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
                menu.previousElementSibling.classList.remove('open');
            });
        }
    });
});