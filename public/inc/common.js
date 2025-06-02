// Menu
function isSafeUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function createMenuTitle(text) {
    const span = document.createElement('span');
    span.className = 'menu-title text-gray-700';
    span.textContent = text || '-';
    return span;
}

function createBullet() {
    const bulletWrapper = document.createElement('span');
    bulletWrapper.className = 'menu-bullet';
    const bullet = document.createElement('span');
    bullet.className = 'bullet bullet-dot';
    bulletWrapper.appendChild(bullet);
    return bulletWrapper;
}

function createLinkItem(text, link, isSub = true) {
    const a = document.createElement('a');
    a.className = 'menu-link';
    a.href = link;
    
    if (isSub) {
        a.appendChild(createBullet());
    }
    
    a.appendChild(createMenuTitle(text));
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'menu-item';
    itemDiv.appendChild(a);
    return itemDiv;
}

function createNoLinkItem(text, isSub = true) {
    const span = document.createElement('span');
    span.className = 'menu-link';
    
    if (isSub) {
        span.appendChild(createBullet());
    }
    
    span.appendChild(createMenuTitle(text));
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'menu-item';
    itemDiv.appendChild(span);
    return itemDiv;
}

function createAccordionItem(item) {
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item menu-accordion';
    menuItem.setAttribute('data-kt-menu-trigger', 'click');
    
    const menuLink = document.createElement('span');
    menuLink.className = 'menu-link';
    
    menuLink.appendChild(createMenuTitle(item.text));
    
    const arrow = document.createElement('span');
    arrow.className = 'menu-arrow';
    menuLink.appendChild(arrow);
    
    menuItem.appendChild(menuLink);
    
    const subMenu = document.createElement('div');
    subMenu.className = 'menu-sub menu-sub-accordion';
    
    (item.subs || []).forEach(sub => {
        if (sub.link && isSafeUrl(sub.link)) {
            subMenu.appendChild(createLinkItem(sub.text, sub.link, true));
        } else {
            subMenu.appendChild(createNoLinkItem(sub.text, true));
        }
    });
    
    menuItem.appendChild(subMenu);
    return menuItem;
}

function buildMenu(menuData, container) {
    menuData.forEach(item => {
        if (item.subs && Array.isArray(item.subs)) {
            container.appendChild(createAccordionItem(item));
        } else if (item.link && isSafeUrl(item.link)) {
            container.appendChild(createLinkItem(item.text, item.link, false));
        } else {
            container.appendChild(createNoLinkItem(item.text, false));
        }
    });
}