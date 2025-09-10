// Universal authentication handler for all pages
class AuthManager {
    constructor() {
        this.user = null;
        this.isLoggedIn = false;
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/auth/user');
            const data = await response.json();
            
            if (data.success) {
                this.user = data.user;
                this.isLoggedIn = true;
                this.updateUI(true);
            } else {
                this.user = null;
                this.isLoggedIn = false;
                this.updateUI(false);
            }
        } catch (error) {
            console.log('Auth check failed:', error);
            this.user = null;
            this.isLoggedIn = false;
            this.updateUI(false);
        }
    }

    updateUI(loggedIn) {
        // Update user profile section if it exists
        const userProfile = document.getElementById('user-profile');
        const loginBtn = document.getElementById('login-btn');
        
        if (userProfile && loginBtn) {
            if (loggedIn) {
                userProfile.classList.remove('hidden');
                loginBtn.style.display = 'none';
                
                const avatar = document.getElementById('user-avatar');
                const name = document.getElementById('user-name');
                if (avatar && name) {
                    avatar.src = this.user.avatar;
                    name.textContent = this.user.name;
                }
            } else {
                userProfile.classList.add('hidden');
                loginBtn.style.display = 'block';
            }
        }
        
        // Replace user icon with profile picture across all pages
        this.replaceUserIcon(loggedIn);
        
        // Show login button if not logged in
        if (!loggedIn) {
            this.showLoginButton();
        }
        
        // Handle Steam login warning (for jackpot page)
        const steamLoginWarning = document.getElementById('steamLoginWarning');
        if (steamLoginWarning) {
            if (loggedIn) {
                steamLoginWarning.classList.add('hidden');
            } else {
                steamLoginWarning.classList.remove('hidden');
            }
        }
    }

    replaceUserIcon(loggedIn) {
        const navRight = document.querySelector('.nav-right .flex');
        if (!navRight) return;

        // Find the user icon (some pages may not have it)
        const userIcon = navRight.querySelector('img[src*="user-circle"]');
        
        if (loggedIn && this.user) {
            if (userIcon) {
                // Replace with profile picture and dropdown
                this.createProfileDropdown(userIcon, navRight);
            }
        } else {
            if (userIcon) {
                // Hide the user icon for guests
                userIcon.style.display = 'none';
            }
            // Remove any existing profile dropdown
            const existingDropdown = navRight.querySelector('.profile-dropdown-container');
            if (existingDropdown) {
                existingDropdown.remove();
            }
        }
    }

    createProfileDropdown(userIcon, navRight) {
        // Remove existing dropdown if it exists
        const existingDropdown = navRight.querySelector('.profile-dropdown-container');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        // Hide the original user icon
        userIcon.style.display = 'none';

        // Create profile dropdown container
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'profile-dropdown-container relative';
        dropdownContainer.style.cssText = 'position: relative; display: inline-block;';

        // Create profile picture button
        const profileBtn = document.createElement('button');
        profileBtn.className = 'profile-btn flex items-center space-x-2';
        profileBtn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px;
            border-radius: 8px;
            transition: background-color 0.3s ease;
        `;

        // Profile picture
        const profileImg = document.createElement('img');
        profileImg.src = this.user.avatar;
        profileImg.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid #4ECCA3;
        `;

        // Username
        const username = document.createElement('span');
        username.textContent = this.user.name;
        username.style.cssText = `
            color: white;
            font-family: sansation;
            font-size: 14px;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

        // Dropdown arrow
        const arrow = document.createElement('span');
        arrow.innerHTML = '▼';
        arrow.style.cssText = `
            color: #4ECCA3;
            font-size: 12px;
            transition: transform 0.3s ease;
        `;

        profileBtn.appendChild(profileImg);
        profileBtn.appendChild(username);
        profileBtn.appendChild(arrow);

        // Create dropdown menu
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'profile-dropdown-menu hidden';
        dropdownMenu.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            background-color: #363636;
            border: 1px solid #424242;
            border-radius: 8px;
            min-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1000;
            margin-top: 8px;
        `;

        // Dropdown items
        const menuItems = [
            { text: 'Profile', icon: '👤', action: () => this.openProfile() },
            { text: 'Settings', icon: '⚙️', action: () => this.openSettings() },
            { text: 'Game History', icon: '📊', action: () => this.openHistory() },
            { text: 'Support', icon: '💬', action: () => this.openSupport() },
            { text: 'Logout', icon: '🚪', action: () => this.logout(), danger: true }
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = 'dropdown-item';
            menuItem.style.cssText = `
                width: 100%;
                padding: 12px 16px;
                background: none;
                border: none;
                color: ${item.danger ? '#ff6b6b' : 'white'};
                font-family: sansation;
                font-size: 14px;
                text-align: left;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
                transition: background-color 0.3s ease;
            `;

            menuItem.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
            menuItem.onclick = item.action;

            // Hover effects
            menuItem.onmouseover = () => {
                menuItem.style.backgroundColor = item.danger ? 'rgba(255, 107, 107, 0.1)' : 'rgba(78, 204, 163, 0.1)';
            };
            menuItem.onmouseout = () => {
                menuItem.style.backgroundColor = 'transparent';
            };

            dropdownMenu.appendChild(menuItem);
        });

        // Toggle dropdown
        let isOpen = false;
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            isOpen = !isOpen;
            if (isOpen) {
                dropdownMenu.classList.remove('hidden');
                arrow.style.transform = 'rotate(180deg)';
            } else {
                dropdownMenu.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';
            }
        };

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            if (isOpen) {
                dropdownMenu.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';
                isOpen = false;
            }
        });

        // Hover effect for profile button
        profileBtn.onmouseover = () => {
            profileBtn.style.backgroundColor = 'rgba(78, 204, 163, 0.1)';
        };
        profileBtn.onmouseout = () => {
            profileBtn.style.backgroundColor = 'transparent';
        };

        dropdownContainer.appendChild(profileBtn);
        dropdownContainer.appendChild(dropdownMenu);

        // Insert before the message icon
        const messageIcon = navRight.querySelector('img[src*="message-dots"]');
        if (messageIcon) {
            navRight.insertBefore(dropdownContainer, messageIcon);
        } else {
            navRight.appendChild(dropdownContainer);
        }
    }

    // Dropdown menu actions
    openProfile() {
        window.open(this.user.profileUrl, '_blank');
    }

    openSettings() {
        // TODO: Create settings page
        alert('Settings page coming soon!');
    }

    openHistory() {
        // TODO: Create history page or redirect to existing one
        window.location.href = '/jackpot.html#history';
    }

    openSupport() {
        // TODO: Create support page
    }

    showLoginButton() {
        // Use the existing login button in the HTML instead of creating a duplicate
        const existingLoginBtn = document.getElementById('login-btn');
        if (existingLoginBtn) {
            existingLoginBtn.style.display = 'block';
            return;
        }
        
        // Fallback: create button only if the HTML one doesn't exist
        const navRight = document.querySelector('.nav-right .flex');
        if (!navRight) return;
        
        const loginButton = document.createElement('button');
        loginButton.id = 'login-btn';
        loginButton.onclick = () => window.location.href = '/login';
        loginButton.style.cssText = `
            background-color: #4ECCA3; 
            color: white; 
            padding: 8px 16px; 
            border-radius: 6px; 
            font-family: sansation; 
            font-weight: bold; 
            border: none; 
            cursor: pointer; 
            transition: all 0.3s ease;
        `;
        loginButton.textContent = 'Login with Steam';
        
        const messageIcon = navRight.querySelector('img[src*="message-dots"]');
        if (messageIcon) {
            navRight.insertBefore(loginButton, messageIcon);
        } else {
            navRight.appendChild(loginButton);
        }
    }

    logout() {
        window.location.href = '/auth/logout';
    }
}

// Global auth manager instance
const authManager = new AuthManager();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    authManager.checkAuthStatus();
});

// Global logout function
function logout() {
    authManager.logout();
}
