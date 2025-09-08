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
        
        // Add login button to nav-right if not logged in and no existing login button
        this.addLoginButtonIfNeeded(loggedIn);
    }

    addLoginButtonIfNeeded(loggedIn) {
        if (loggedIn) return;
        
        const navRight = document.querySelector('.nav-right .flex');
        if (!navRight) return;
        
        // Check if login button already exists
        const existingLoginBtn = navRight.querySelector('.steam-login-btn');
        if (existingLoginBtn) return;
        
        // Create login button
        const loginButton = document.createElement('button');
        loginButton.className = 'steam-login-btn';
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
        loginButton.textContent = 'Login';
        
        // Add hover effects
        loginButton.onmouseover = () => {
            loginButton.style.backgroundColor = '#389676';
        };
        loginButton.onmouseout = () => {
            loginButton.style.backgroundColor = '#4ECCA3';
        };
        
        // Insert before the last child (message icon)
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
