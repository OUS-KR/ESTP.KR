
document.addEventListener('DOMContentLoaded', () => {
    const navLinksContainer = document.getElementById('nav-links');
    const contentGrid = document.getElementById('content-grid');

    fetch('/u/tests/assets/menu.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(menuData => {
            if (navLinksContainer) {
                generateNav(menuData);
            }
            if (contentGrid) {
                generateGrid(menuData);
            }
        })
        .catch(error => {
            console.error('Failed to load menu data:', error);
            if (navLinksContainer) navLinksContainer.innerHTML = '<p style="color: red; padding: 15px;">메뉴를 불러오지 못했습니다.</p>';
            if (contentGrid) contentGrid.innerHTML = '<p style="color: red; padding: 15px;">콘텐츠를 불러오지 못했습니다.</p>';
        });

    function generateNav(data) {
        navLinksContainer.innerHTML = ''; // Clear existing nav
        data.forEach(mainMenu => {
            const navItem = document.createElement('div');
            navItem.className = 'nav-item dropdown';

            const toggleButton = document.createElement('button');
            toggleButton.className = 'dropdown-toggle';
            toggleButton.textContent = mainMenu.mainTitle;

            const dropdownMenu = document.createElement('div');
            dropdownMenu.className = 'dropdown-menu';

            mainMenu.items.forEach(item => {
                const link = document.createElement('a');
                link.href = item.url;
                // For the dropdown, use a shorter title if available, otherwise the main title
                link.textContent = item.title.split(':')[0]; 
                dropdownMenu.appendChild(link);
            });

            navItem.appendChild(toggleButton);
            navItem.appendChild(dropdownMenu);
            navLinksContainer.appendChild(navItem);
        });
    }

    function generateGrid(data) {
        contentGrid.innerHTML = ''; // Clear existing grid

        const typeClassMap = {
            '정보': 'info',
            '테스트': 'test',
            '게임': 'game',
            '운세': 'info' // Map '운세' to 'info' style as a fallback
        };
        
        // Flatten all items from all menus
        const allItems = data.flatMap(mainMenu => mainMenu.items);

        allItems.forEach(item => {
            const card = document.createElement('a');
            card.href = item.url;
            card.className = 'content-card';

            const typeSpan = document.createElement('span');
            const typeName = item.type;
            const typeClass = typeClassMap[typeName] || 'info'; // Default to 'info' if type not found

            typeSpan.className = `card-type ${typeClass}`;
            typeSpan.textContent = typeName;

            const titleH3 = document.createElement('h3');
            titleH3.textContent = item.title;

            card.appendChild(typeSpan);
            card.appendChild(titleH3);
            contentGrid.appendChild(card);
        });
    }
});
